var log = require('anylogger')('cc:db')

var mysql = require('mysql')
var Umzug = require('umzug')

var { raise } = require('../errors')

var db = module.exports = {
  init,
  connect,
  single,
  toObject,
  toMap,
}

var host = {
  host: process.env.DB_HOST !== undefined ? process.env.DB_HOST : 'localhost',
  port: process.env.DB_PORT !== undefined ?  process.env.DB_PORT : '3306',
}

var user = {
  user: process.env.DB_USER !== undefined ? process.env.DB_USER : 'root',
  password: process.env.DB_PASS !== undefined ? process.env.DB_PASS : 'secret',
}

var options = {
  database: process.env.DB_NAME !== undefined ? process.env.DB_NAME : 'auto',
  connectionLimit: 10,
}

var pool;

function init() {
  return loadPendingMigrations()
  .then(executeMigrations)
  .catch(error => {
    if (error.errno !== 1146) throw error;
    return createMigrationsTable().then(init)
  })
}

function connect(cfg) {
  cfg = { ...({ ...host, ...user, ...options }), ...(cfg || {}) }
  return new Promise((resolve, reject) => {
    if (! pool) {
      // create a connection pool with the given config
      log('log', `Connecting to database '${cfg.database}' at ${cfg.host}:${cfg.port} as user '${cfg.user}'`)
      var newPool = mysql.createPool(cfg);
      // verify it all works as expected
      newPool.getConnection((err, connection) => {
        if (err) {
          if (err.errno !== 1049) return reject(err)
          log('log', `Database '${cfg.database}' does not exist. Creating it`)
          var con = mysql.createConnection({ host:cfg.host, port:cfg.port, user:cfg.user, password:cfg.password });
          con.connect(err => {
            if (err) return reject(err)
            var query = `CREATE DATABASE \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
            con.query(query, err => {
              if (err) return reject(err)
              con.end()
              log('info', `Created database '${cfg.database}'`)
              return connect(cfg).then(resolve).catch(reject)
            })
          })
        } else {
          connection.query('SELECT 1', (err, results, fields) => {
            if (err) return reject(err)
            log('info', `Connected to database '${cfg.database}'`)
            pool = newPool
            module.exports.available = true
            return resolve(instrument(connection, cfg))
          })
        }
      })
    }
    else {
      pool.getConnection((err, connection) => {
        if (err) return reject(err)
        resolve(instrument(connection, cfg))
      })
    }
  })
}

function toObject(result) {
  if (result && result.results) result = result.results
  return result && (
    Array.isArray(result) ? result.map(toObject) :
    Object.keys(result)
    .map(key => ({[key]: result[key]}))
    .reduce((r,x) => ({ ...r, ...x }), {})
  )
}

function single(results) {
  if (results.results) results = results.results
  if (results.length > 1) {
    log('error', `Expected a single result but got ${results.length} results`)
    raise(500, `Internal server error`)
  }
  return results[0]
}

/**
 * Takes an array of objects that have some unique key field and
 * returns an object with the elements mapped by the value of the key field.
 *
 * toMap('k', [{ k:'a', v:1 }, { k:'b', v:'2' }])
 * =>
 * { a:{ k:'a', v:1 }, b:{ k:'b', v:2 } }
 *
 * @param {String} key Name of the id field, defaults to 'id'
 * @param {Array} objects The objects to map, defaults to empty array
 */
function toMap(key = 'id', objects = []) {
  return objects.reduce((r,v) => (r[v[key]] = v) && r, {})
}

function loadPendingMigrations() {
  return umzug().pending()
  .then(migrations => migrations.map(m => m.file.replace(/\.js$/, '')))
  .then(migrations => {
    if (! migrations.length) log('info', `Database is up to date`)
    return migrations
  })
}

function executeMigrations(migrations) {
  return umzug().execute({ migrations })
  .then(migrations => {
    if (migrations.length) log('info', `Executed ${migrations.length} database migrations`)
    return migrations
  })
}


function instrument(connection, cfg) {
  if (! connection.instrumented) {
    connection.instrumented = true
    connection.log = cfg.log || log
    connection.query = instrumented.bind(connection, connection.query)
  }
  return connection
}

function instrumented() {
  var args = [].slice.call(arguments)
  var orgFn = args.shift()
  ;(this.log || log)('debug', ...args)
  return new Promise((resolve, reject) => {
    args.push((err, results, fields) => {
      if (err) {
        this.release()
        return reject(err)
      }
      resolve({ results, fields })
    })
    orgFn.apply(this, args)
  })
}


function createMigrationsTable(name = 'migrations') {
  return db.connect().then(db => {
    return db.query(`
CREATE TABLE migrations (
  name VARCHAR(36) NOT NULL,
  PRIMARY KEY(name)
)
ENGINE=InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci
COMMENT='Contains the names of the database migration scripts that have run so far. Used at startup to determine whether the database is up to date with the software and if not, migrate it to be up to date.'
    `)
    .then(() => db.release())
    .then(() => log('info', `Created table '${name}'`))
  })
}

var _umzug;
function umzug() {
  return _umzug || (_umzug = new Umzug({
    storage: new MySqlStorage(db),
    logging: log,
    migrations: {
      path: './db',
      pattern: /^\d+[\w-]+\.js$/,
    }
  }))
}

class MySqlStorage {
  constructor(db, table, col) {
    this.db = db
    this.table = table || 'migrations'
    this.col = col || 'name'
  }
  logMigration(name) {
    log(`Adding migration ${name} to completed list`)
    return this.db.connect().then(db =>
      db.query(`INSERT INTO ${this.table} (${this.col}) VALUES (?)`, name)
      .then(() => log(`Migration ${name} added`))
      .then(() => db.release())
    )
  }
  unlogMigration(name) {
    log(`Removing migration ${name} from completed list`)
    return this.db.connect().then(db =>
      db.query(`DELETE FROM ${this.table} WHERE ${this.col} = ?`, name)
      .then(() => log(`Migration ${name} removed`))
      .then(() => db.release())
    )
  }
  executed() {
    log(`Fetching list of completed migrations`)
    return this.db.connect().then(db =>
      db.query(`SELECT ${this.col} FROM ${this.table} ORDER BY ${this.col} ASC`)
      .then(({ results }) => {
        db.release()
        return results.map(r => r[this.col])
      })
    )
  }
}
