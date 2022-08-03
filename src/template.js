const fs = require('fs')

const PROD = process.env.NODE_ENV == 'production'

let reg = Object.create(null)
module.exports = function template(path = 'index.html', encoding = 'utf-8') {
    let tpl = PROD && reg[path] || (reg[path] = fs.readFileSync(path, encoding))
    return function render({ appTitle = `Hello`, appContent = `<h1>Hello World!</h1>` }) {
        return tpl
            .replace(`<!--app-title-->`, appTitle)
            .replace(`<!--app-html-->`, appContent)
    }
}
