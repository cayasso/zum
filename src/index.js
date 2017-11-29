 'use strict'

const server = require('./server')
const client = require('./client')

const bind = (...args) => server(...args)
const connect = (...args) => client(...args)

const zum = options => ({
  bind: fn => bind(options, fn),
  connect: fn => connect(options, fn)
})

zum.bind = bind
zum.connect = connect
module.exports = zum
