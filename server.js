const path = require('path')
const express = require('express')
const template = require('./src/template')

const app = express()
const PROD = process.env.NODE_ENV === 'production' 
const HOST = process.env.HOST || 'localhost'
const PORT = Number(process.env.PORT || 3000)

function handler(req, res, next) {
  const render = template(path.resolve(__dirname, 'src', 'index.html'), 'utf-8')
  const html = render({ appTitle: `Hello`, appContent: `<h1>Hello World!</h1>`})
  res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
}

PROD && app.use(require('compression')())
app.use(express.static('public'))
app.use(handler)

const server = app.listen(PORT, () => {
  console.log(`http://${HOST}:${PORT}`)
})

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server stopped.')
  })
})
