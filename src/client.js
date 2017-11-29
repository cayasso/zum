'use strict'

const Emitter = require('eventemitter3')
const { Stream: Parser } = require('amp')
const Message = require('amp-message')
const async = require('async')
const retry = require('tries')
const yeast = require('yeast')
const net = require('netly')
const dbg = require('debug')

const { encrypt, decrypt } = require('./security')
const { HSK, SUB, UNS, PUB, ACK, HOST } = require('./constants')

const debug = dbg('zum:client')
const noop = () => {}
const reservedEvents = {
  'reconnect failed': 1,
  'reconnecting': 1,
  'disconnect': 1,
  'reconnect': 1,
  'connect': 1,
  'error': 1,
  'end': 1
}

const reg = new RegExp(`^${HSK}|${SUB}|${UNS}|${PUB}|${ACK}$`)

module.exports = (options = {}, cb) => {
  if (typeof options === 'string') {
    options = { host: options }
  }

  if (typeof options === 'function') {
    cb = options
    options = {}
  }

  const {
    secret,
    algorithm,
    id = yeast(),
    host = HOST,
    delay = 100,
    minDelay = 1000,
    maxDelay = 5000,
    retries = Infinity,
    secure = true,
  } = options

  const fns = {}
  const queue = []
  const events = []
  const emitter = new Emitter()

  let sock = null
  let queueing = false
  let destroyed = false

  const pack = args => {
    const last = args[args.length - 1]
    if (typeof last === 'function') {
      const id = 'i:' + yeast()
      const fn = args.pop()
      fns[id] = fn
      args.unshift(Buffer.from(id))
    }

    const msg = new Message(args)

    if (secure !== true) return msg
    const buf = msg.toBuffer()
    const secureBuf = [encrypt(buf, secret, algorithm)]
    return new Message(secureBuf)
  }

  const send = (...args) => {
    let force = false
    if (args[args.length - 1] === true) {
      force = args.pop()
    }
    const msg = pack(args)
    if (sock && sock.writable && !queueing || force && queueing) {
      sock.write(msg.toBuffer())
    } else {
      queue.push(msg.args)
    }
  }

  const handshake = () => send(HSK, events, cb)
  const isAck = arg => arg[0] === 105 && arg[1] === 58
  const re = retry({ retries, min: minDelay, max: maxDelay })
  const reserved = event => reg.test(event) || event in reservedEvents
  const publish = (ev, data) => send(PUB, `s:${ev}`, data)

  const listen = (ev, fn) => {
    if (!reserved(ev)) {
      events.push(ev)
      send(SUB, ev)
    }
    emitter.on(ev, fn)
  }

  const unlisten = (ev, fn) => {
    if (!reserved(ev)) send(UNS, ev)
    emitter.off(ev, fn)
  }

  const subscribe = (ev, fn) => {
    if (!reserved(ev)) listen(`s:${ev}`, fn)
  }

  const unsubscribe = (ev, fn) => {
    if (!reserved(ev)) unlisten(`s:${ev}`, fn)
  }

  const reply = (id, args) => {
    const len = args.length
    const msg = new Array(2 + len)
    msg[0] = ACK
    msg[1] = id
    for (let i = 0; i < len; ++i) {
      msg[i + 2] = args[i]
    }
    return msg
  }

  const ondata = sbuf => {
    let buf = sbuf

    if (secure) {
      const secureMsg = new Message(sbuf)
      const secureBuf = secureMsg.args[0]

      try {
        buf = decrypt(secureBuf, secret, algorithm)
      } catch(err) {
        return
      }
    }

    const { args } = new Message(buf)

    if (PUB === args[0]) {
      args.shift()
    }

    // Reply message, invoke the given callback
    if (ACK === args[0]) {
      args.shift()
      const id = args.shift().toString()
      const fn = fns[id]
      delete fns[id]
      if (fn) fn(...args)
      return
    }

    // Request method, pass a trailing callback
    if (isAck(args[0])) {
      const id = args.shift()
      args.push((...arg) => send(...reply(id, arg)))
    }

    emitter.emit(...args)
    emitter.emit(...['data', args])
  }

  const destroy = reconnect => {
    sock.destroy()
    sock.removeAllListeners()
    if (reconnect) return
    destroyed = true
    emitter.removeAllListeners()
  }

  const reconnect = () => {
    if (destroyed) {
      debug('already destroyed')
      return
    }
    debug('reconnect')
    re.retry((fail, backoff) => {
      if (fail) {
        debug('reconnect failed', backoff)
        emitter.emit('reconnect failed', backoff)
        return destroy()
      }
      debug('reconnecting', backoff)
      emitter.emit('reconnecting', backoff)
      connect()
    })
  }

  const run = () => {
    queueing = true
    async.eachSeries(queue, (args, next) => {
      setTimeout(() => {
        args.push(true)
        send(...args)
        next()
      }, delay)
    }, () => {
      queueing = false
      queue.length = 0
    })
  }

  const onconnect = () => {
    handshake()
    emitter.emit('connect', { id, host })
    run()
    re.clear()
  }

  const onerror = err => {
    console.error(err)
    emitter.emit('error', err)
    destroy(true)
    reconnect()
  }

  const connect = (fn = noop) => {
    const parser = new Parser()
    sock = net.connect(host, err => {
      if (err) return fn(err)
      fn(null, { id, host })
    })
    sock.pipe(parser)
    parser.on('data', ondata)
    sock.once('error', onerror)
    sock.once('end', reconnect)
    sock.once('connect', onconnect)

    return Object.assign(emitter, {
      send,
      destroy,
      reconnect,
      listen,
      unlisten,
      publish,
      subscribe,
      unsubscribe
    })
  }

  return connect(cb)

}
