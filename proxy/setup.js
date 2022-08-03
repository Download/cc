const childProcess = require('child_process')
const { access, readFile, writeFile } = require('fs/promises')
const R_OK = require('fs').constants.R_OK
const name = process.env.NAME
const host = process.env.VIRTUAL_HOST

const certs = 'proxy/certs';
const template = 'proxy/domains.template'

async function run() {
  try {
    if (!(await exists(`${certs}/ca.key`)) || 
        !(await exists(`${certs}/ca.pem`)) || 
        !(await exists(`${certs}/ca.crt`))) {
      console.info((await exec(`openssl req -x509 -nodes -new -sha256 -days 1024 -newkey rsa:2048 -keyout ${certs}/ca.key -out ${certs}/ca.pem -subj "/C=NL/CN=${name.toUpperCase()}-CA"`)).stderr)
      console.info((await exec(`openssl x509 -outform pem -in ${certs}/ca.pem -out ${certs}/ca.crt`)).stderr)
      console.info(`
=====================================================================
Generated Certificate Authority '${name.toUpperCase()}-CA':
  ${certs}/ca.key (private key)
  ${certs}/ca.pem (signing request)
  ${certs}/ca.crt (certificate)

Install '${name.toUpperCase()}-CA' on your development machine:
  * Double-click ${certs}/ca.crt
  * Windows: Install in 'Trusted certificate authorities'
  * Mac OS: Will be added to the 'system' keychain

You will have to restart your browser for it to pick up 
the new CA and trust your self-signed dev certificate
---------------------------------------------------------------------
`     )
    }
  
    if (! (await exists(`${certs}/${host}.ext`))) { 
      const domains = (await readFile(template, 'utf-8')).replaceAll('{name}', name)
      await writeFile(`${certs}/${host}.ext`, domains, 'utf-8')
      const lines = []
      const regex = /(?:DNS\.\d\s?\=\s?)(.*)\n?/g
      let match
      while (match = regex.exec(domains)) {
        lines.push(`127.0.0.1\t${match[1]}`)
      }
      console.info(`
=====================================================================
Generated file containing domains for dev certificate:
  ${certs}/${host}.ext (from ${template})

Add these entries to your /etc/hosts file:
  
${lines.join('\n')}

To customize this list of domains: 
  * Remove ${certs}/${host}.ext (and corresponding host file entries)
  * Edit ${template}
  * Re-run this setup to re-generate ${certs}/${host}.ext
  * Update /etc/hosts on your machine with the new entries
---------------------------------------------------------------------
`     )
    }


    console.info(`Checking ${certs}/${host}.key ...`)
    if (!(await exists(`${certs}/${host}.key`)) || !(await exists(`${certs}/${host}.csr`)) || !(await exists(`${certs}/${host}.crt`))) {
      const serialExisted = await exists(`${certs}/ca.srl`)
      console.info((await exec(`openssl req -new -nodes -newkey rsa:2048 -keyout ${certs}/${host}.key -out ${certs}/${host}.csr -subj "/C=NL/O=${name.toUpperCase()}-Certificate/CN=localhost"`)).stderr)
      console.info((await exec(`openssl x509 -req -sha256 -days 397 -in ${certs}/${host}.csr -CA ${certs}/ca.pem -CAkey ${certs}/ca.key -CAserial ${certs}/ca.srl -CAcreateserial -extfile ${certs}/${host}.ext -out ${certs}/${host}.crt`)).stderr)
      console.info(`
=====================================================================
Generated '${name.toUpperCase()}-Certificate'` + 
(serialExisted ? ':' : ` and serial:\n  ${certs}/ca.srl (serial)`) + `
  ${certs}/${host}.key (private key)
  ${certs}/${host}.csr (certificate signing request)
  ${certs}/${host}.crt (certificate)

If you customized ${template} or the certificate expires 
(in 397 days, see https://google.com/search?q=ssl+expiry+397):
  * Remove ${certs}/${host}.*
  * Re-run this setup to regenerate the certificate
---------------------------------------------------------------------
`     )
    }
  } catch(e) {
    console.error('error: ', e)
  }
}

/**
 * @param {string} cmd A shell command to execute
 * @return {Promise<{stdout, stderr}>} A promise that resolves to an object with the stdout, stderr output of the shell command
 * @example const { stdout, stderr } = await execute("ls -alh");
 */
function exec(cmd) {
  /**
   * @param {Function} resolve A function that resolves the promise
   * @param {Function} reject A function that fails the promise
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
   */
  return new Promise(function(resolve, reject) {
      /**
       * @param {Error} error An error triggered during the execution of the childProcess.exec command
       * @param {string|Buffer} stdout The output sent to stdout by the shell command
       * @param {string|Buffer} stderr The output sent to stderr by the shell command
       * @see https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
       */
      childProcess.exec(cmd, function(error, stdout, stderr) {
          if (error) {
              return reject(error);
          }

          resolve({stdout, stderr});
      });
  });
}

async function exists(path) {
  try {
    await access(path, R_OK);
    return true
  } catch {
    return false
  }
}


run()
