'use strict';

/**
 * Module dependencies.
 */

import { HSK, SUB, UNS, PUB, ACK, HOST } from './constants';
import { Stream as Parser } from 'amp';
import Emitter from 'eventemitter3';
import Message from 'amp-message';
import async from 'async';
import retry from 'tries';
import yeast from 'yeast';
import net from 'netly';
import dbg from 'debug';

const debug = dbg('zum:client');
const noop = () => {};
const reserved = {
  'reconnect failed': 1,
  'reconnecting': 1,
  'disconnect': 1,
  'reconnect': 1,
  'connect': 1,
  'error': 1,
  'end': 1
};

const reg = new RegExp(`^${HSK}|${SUB}|${UNS}|${PUB}|${ACK}$`);

export default (options = {}, cb) => {

  const {
    id = yeast(),
    prefix = '',
    host = HOST,
    delay = 100,
    minDelay = 1000,
    maxDelay = 5000,
    retries = Infinity
  } = options;

  const fns = {};
  const queue = [];
  const events = [];
  const emitter = new Emitter();

  const handshake = fn => send(HSK, events, cb);
  const isAck = arg => 105 == arg[0] && 58 == arg[1];
  const re = retry({ retries, min: minDelay, max: maxDelay });
  const reserved = event => reg.test(event) || event in reserved;
  const publish = (ev, data) => send(PUB, `s:${ev}`, data);

  let sock = null;
  let queueing = false;
  let destroyed = false;

  const listen = (ev, fn) => {
    if (!reserved(ev)) {
      events.push(ev);
      send(SUB, ev);
    }
    emitter.on(ev, fn);
  }

  const unlisten = (ev, fn) => {
    if (!reserved(ev)) send(UNS, ev);
    emitter.off(ev, fn);
  }

  const subscribe = (ev, fn) => {
    if (!reserved(ev)) listen(`s:${ev}`, fn);
  }

  const unsubscribe = (ev, fn) => {
    if (!reserved(ev)) unlisten(`s:${ev}`, fn);
  }

  const connect = (fn = noop) => {
    const parser = new Parser();
    sock = net.connect(host, err => {
      if (err) return fn(err);
      fn(null, { id, host });
    });
    sock.pipe(parser);
    parser.on('data', ondata);
    sock.once('error', onerror);
    sock.once('end', reconnect);
    sock.once('connect', onconnect);

    return Object.assign(emitter, {
      send,
      destroy,
      reconnect,
      listen,
      unlisten,
      publish,
      subscribe,
      unsubscribe
    });
  }

  const send = (...args) => {
    let force = false;
    if (true === args[args.length - 1]) {
      force = args.pop();
    }
    console.log(args);
    const msg = packet(args);
    if (sock && sock.writable && !queueing || force && queueing) {
      sock.write(msg.toBuffer());
    } else {
      queue.push(msg.args);
    }
  }

  const run = () => {
    queueing = true;
    async.eachSeries(queue, (args, next) => {
      setTimeout(() => {
        args.push(true);
        send(...args);
        next();
      }, delay);
    }, err => {
      queueing = false;
      queue.length = 0;
    });
  }

  const reconnect = () => {
    if (destroyed) {
      debug('already destroyed');
      return;
    }
    debug('reconnect');
    re.retry((fail, backoff) => {
      if (fail) {
        debug('reconnect failed', backoff);
        emitter.emit('reconnect failed', backoff);
        return destroy();
      }
      debug('reconnecting', backoff);
      emitter.emit('reconnecting', backoff);
      connect();
    });
  }

  const destroy = reconnect => {
    sock.destroy();
    sock.removeAllListeners();
    if (reconnect) return;
    destroyed = true;
    emitter.removeAllListeners();
  }

  const packet = args => {
    const last = args[args.length - 1];
    if ('function' === typeof last) {
      const id = 'i:' + yeast();
      const fn = args.pop();
      fns[id] = fn;
      args.unshift(new Buffer(id));
    }
    return new Message(args);
  }

  const onconnect = () => {
    handshake();
    emitter.emit('connect', { id, host });
    run();
    re.clear();
  }

  const ondata = buf => {
    console.log('RECEIVING');
    const { args } = new Message(buf);

    if (PUB === args[0]) {
      args.shift();
    }

    // reply message, invoke
    // the given callback
    if (ACK === args[0]) {
      args.shift();
      let id = args.shift().toString();
      const fn = fns[id];
      delete fns[id];
      if (fn) fn(...args);
      return;
    }

    // request method, pass
    // a trailing callback
    if (isAck(args[0])) {
      let id = args.shift();
      args.push(() => send(...reply(id, arguments)));
    }

    emitter.emit(...args);
    emitter.emit(...['data', args]);
  }

  const onerror = err => {
    console.error(err);
    emitter.emit('error', err);
    destroy(true);
    reconnect();
  }

  const reply = (id, args) => {
    var len = args.length;
    var msg = new Array(2 + len);
    msg[0] = ACK;
    msg[1] = id;
    for (let i = 0; i < len; ++i) {
      msg[i + 2] = args[i];
    }
    return msg;
  };

  const c = connect(cb);
  console.log(c);
  return c;

}
