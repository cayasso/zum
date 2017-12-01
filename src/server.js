'use strict'

const Emitter = require('eventemitter3')
const createWildcard = require('wildcard-wrapper')
const { Stream: Parser } = require('amp')
const Message = require('amp-message')
const net = require('netly')
const dbg = require('debug')

const { HSK, SUB, UNS, PUB, ACK, HOST, SEND, BROADCAST } = require('./constants')
const { encrypt, decrypt } = require('./security')
const createTopic = require('./topic')

const debug = dbg('zum:server')

module.exports = async (options = {}) => {
  if (typeof options === 'string') {
    options = { host: options }
  }

  const wildcard = createWildcard()
  const acks = {}
  const topics = {}
  const { host = HOST, secure = true, secret, algorithm } = options
  const emitter = new Emitter()
  const server = net.bind(host)

  const close = fn => server.close(fn)
  const isAck = arg => arg[0] === 105 && arg[1] === 58

  const topic = (ns, sock, tp) => {
    if (ns) {
      wildcard.add(ns)
      tp = topics[ns]
    }
    (tp || (topics[ns] = createTopic(ns))).add(sock)
  }

  const onerror = (err) => {
    debug(err)
    emitter.emit('error', err)
  }

  const onlistening = () => {
    emitter.emit('listening', { host })
  }

  const processWildcards = (ev, args, type) => {
    let matches = wildcard.match(ev, true)
    if (SEND === type && matches.length > 0) {
      matches = [matches.sort((a, b) => b.key.length - a.key.length)[0]]
    }
    matches.forEach(({ key, segs }) => {
      const tp = topics[key]
      let cb = null
      if (!tp) return
      if (isAck(args[0])) cb = args.shift()
      args.shift()
      args.unshift(segs[1])
      args.unshift(key)
      if (cb) args.unshift(cb)

      let msg = new Message(args)

      if (secure) {
        const buf = msg.toBuffer()
        const secureBuf = [encrypt(buf, secret, algorithm)]
        msg = new Message(secureBuf)
      }

      tp[type](msg.toBuffer())
    })
  }

  const ondata = sock => sbuf => {
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
    const ns = args[1]

    let ev = args[0]
    let tp = null

    switch (ev) {
      case HSK: {
        const events = ns || []
        events.forEach(ns => topic(ns, sock))
        break
      }

      case ACK: {
        const _sock = acks[ns]
        if (_sock && _sock.writable) {
          _sock.write(sbuf)
          delete acks[ns]
        }
        break
      }

      case SUB:
        topic(ns, sock)
        break

      case UNS:
        if (ns) {
          wildcard.remove(ns)
          tp = topics[ns]
        }
        tp = tp || tp.remove(sock)
        break

      case PUB:
        args.shift()
        ev = args[0]
        tp = topics[ev]
        if (tp) tp.broadcast(sbuf)
        emitter.emit(...args)
        processWildcards(ev, args, BROADCAST)
        break

      default:
        if (isAck(ev)) {
          acks[ev] = sock
          ev = ns
        }
        tp = topics[ev]
        if (tp) tp.send(sbuf)
        else processWildcards(ev, args, SEND)
        emitter.emit(...args)
    }
  }

  const ondisconnect = sock => () => {
    Object.keys(topics).map(k => topics[k].remove(sock))
    sock.removeAllListeners()
    emitter.emit('disconnect', sock)
  }

  const onconnect = sock => {
    const parser = new Parser()
    sock.pipe(parser)
    parser.on('data', ondata(sock))
    emitter.emit('connect', sock)
    sock.on('close', ondisconnect(sock))
  }

  server.on('listening', onlistening)
  server.on('connection', onconnect)
  server.on('error', onerror)

  return new Promise((resolve, reject) => {
    emitter.once('listening', info => {
      resolve(Object.assign(emitter, { close, ...info }))
    })
    emitter.on('error', reject)
  })
}
