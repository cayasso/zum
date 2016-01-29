'use strict';

/**
 * Module dependencies.
 */

import wildcard from 'wildcard-wrapper';
import { Stream as Parser } from 'amp';
import Emitter from 'eventemitter3';
import Message from 'amp-message';
import async from 'async';
import Retry from 'tries';
import yeast from 'yeast';
import net from 'netly';

const HOST = 'tcp://127.0.0.1:5555';
const noop = () => {};
const slice = [].slice;
const reserved = {
  'reconnect failed': 1,
  'reconnecting': 1,
  'disconnect': 1,
  'reconnect': 1,
  'connect': 1,
  'error': 1,
  'end': 1
};

/**
 * Initialize `Client` object.
 *
 * @type {Topic}
 * @api public
 */

export default class Client extends Emitter {

  /**
   * Initilaize Client.
   *
   * @param {Object} options
   * @return {Client} this
   * @api public
   */

  constructor(options) {
    super();
    const {
      id = String(process.pid),
      prefix = '',
      host = HOST,
      delay = 100,
      minDelay = 1000,
      maxDelay = 5000,
      retries = Infinity
    } = options;

    this.fns = {};
    this.queue = [];
    this.events = [];
    this.id = id;
    this.host = host;
    this.delay = delay;
    this.prefix = prefix;
    this.re = Retry({ retries, min: minDelay, max: maxDelay });
  }

  /**
   * Checks if the given event is an emitted event by Primus.
   *
   * @param {String} event.
   * @returns {Boolean}
   * @api public
   */

  reserved(event) {
    return (/^(bus)::/).test(event)
    || event in reserved;
  }

  /**
   * Start listening to event.
   *
   * @param {String} ev
   * @param {Function} [fn]
   * @api public
   */

  listen(ev, fn) {
    if (!this.reserved(ev)) {
      this.events.push(ev);
      this.send('bus::sub', ev);
    }
    this.on(ev, fn);
  }

  /**
   * Stop listening to event.
   *
   * @param {String} ev
   * @param {Function} [fn]
   * @api public
   */

  unlisten(ev, fn) {
    if (!this.reserved(ev)) {
      this.send('bus::unsub', ev);
    }
    this.off(ev, fn);
  }

  /**
   * Subscribe to event.
   *
   * @param {String} ev
   * @param {Function} [fn]
   * @api public
   */

  subscribe(ev, fn) {
    if (!this.reserved(ev)) this.listen(`s:${ev}`, fn);
  }

  /**
   * Unsubscribe from event.
   *
   * @param {String} ev
   * @param {Function} [fn]
   * @api public
   */

  unsubscribe(ev, fn) {
    if (!this.reserved(ev)) this.unlisten(`s:${ev}`, fn);
  }

  /**
   * Connect to the given `host`.
   *
   * @param {Function} [fn]
   * @return {Client}
   * @api public
   */

  connect(fn = noop) {
    this.sock = net.connect(this.host, err => {
      if (err) return fn(err);
      fn(null, this.data);
    });
    this.bindEvents();
    return this;
  }

  /**
   * Bind `sock` events.
   *
   * @return {Client} this
   * @api private
   */

  bindEvents() {
    const parser = new Parser();
    this.sock.pipe(parser);
    parser.on('data', this.ondata.bind(this));
    this.sock.once('error', this.onerror.bind(this));
    this.sock.once('end', this.ondisconnect.bind(this));
    this.sock.once('connect', this.onconnect.bind(this));
  }

  /**
   * Publish message.
   *
   * @param {String} ev
   * @param {Mixed} data
   * @return {Client}
   * @api public
   */

  publish(ev, data) {
    return this.send('bus::pub', `s:${ev}`, data);
  }

  /**
   * Send message.
   *
   * @param {String} ev
   * @param {Mixed} ...
   * @return {Client}
   * @api public
   */

  send(ev, data) {
    let force = false;
    const args = slice.call(arguments);
    if (true === args[args.length - 1]) {
      force = args.pop();
    }
    const msg = this.packet(args);
    const sock = this.sock;
    if (sock && sock.writable && !this.queueing || force && this.queueing) {
      sock.write(msg.toBuffer());
    } else {
      this.queue.push(msg.args);
    }
    return this;
  }


  /**
   * Execute queue.
   *
   * @api private
   */

  exec() {
    this.queueing = true;
    async.eachSeries(this.queue, (args, next) => {
      setTimeout(() => {
        args.push(true);
        this.send(...args);
        next();
      }, this.delay);
    }, err => {
      this.queueing = false;
      this.queue.length = 0;
    });
  }

  /**
   * Reconnect Client.
   *
   * @api public
   */

  reconnect() {
    if (this.destroyed) {
      debug('already destroyed');
      return this;
    }
    //debug('reconnect');
    this.re.retry((fail, backoff) => {
      if (fail) {
        console.log('Connection failed');
        //debug('reconnect failed', backoff);
        this.emit('reconnect failed', backoff);
        return this.destroy();
      }
      //debug('reconnecting', backoff);
      this.emit('reconnecting', backoff);
      this.connect();
    });
  }

  /**
   * Destroy Client.
   *
   * @param {Boolean} reconnect
   * @api public
   */

  destroy(reconnect) {
    this.sock.destroy();
    this.sock.removeAllListeners();
    if (reconnect) return;
    this.destroyed = true;
    this.removeAllListeners();
  }

  /**
   * Initial handshake with server, sending subscribed events.
   *
   * @api private
   */

  handshake(fn) {
    this.send('bus::hsk', this.events, fn);
  }

  /**
   * Packet message for sending.
   *
   * @param {Array} args
   * @return {Buffer}
   * @api private
   */

  packet(args) {
    const last = args[args.length - 1];
    if ('function' === typeof const) {
      const id = 'i:' + yeast();
      const fn = args.pop();
      this.fns[id] = fn;
      args.unshift(new Buffer(id));
    }
    return new Message(args);
  }

  /**
   * Called when `sock` is connected to server.
   *
   * @api private
   */

  onconnect() {
    this.handshake();
    this.emit('connect', this.data);
    this.exec();
    this.re.clear();
  }

  /**
   * Called upon receiving message.
   *
   * @param {Buffer} buf
   * @api private
   */

  ondata(buf) {
    const msg = new Message(buf);
    const args = msg.args;

    if ('bus::pub' === args[0]) {
      args.shift();
    }

    // reply message, invoke
    // the given callback
    if ('bus::ack' === args[0]) {
      args.shift();
      let id = args.shift().toString();
      const fn = this.fns[id];
      delete this.fns[id];

      if (fn) fn(...args);
      return;
    }

    // request method, pass
    // a trailing callback
    if (isAck(args[0])) {
      let id = args.shift();
      args.push(() => {
        this.send(...reply(id, arguments));
      });
    }

    this.emit(...args);
    this.emit(...['data', args]);
  }

  /**
   * Called upon `sock` or error message.
   *
   * @param {Error} err
   * @api private
   */

  onerror(err) {
    console.error(err);
    this.emit('error', err);
    this.destroy(true);
    this.reconnect();
  }

  /**
   * Called upon `sock` disconnection.
   *
   * @api private
   */

  ondisconnect() {
    this.reconnect();
  }

  /**
   * Method to extend Client.
   *
   * @param {Function} fn
   * @param {Object} options
   * @return {Client}
   * @api public
   */

  use(fn, options) {
    fn(this, options)
    return this;
  }

  /**
   * Lazy get client data.
   *
   * @type {Object}
   * @api public
   */

  get read() {
    return { id: this.id, host: this.host };
  }

}

/**
 * Return a reply message for `id` and `args`.
 *
 * @param {String} id
 * @param {Array} args
 * @return {Array}
 * @api private
 */

const reply = (id, args) => {
  var len = args.length;
  var msg = new Array(2 + len);
  msg[0] = 'bus::ack';
  msg[1] = id;
  for (var i = 0; i < len; ++i) {
    msg[i + 2] = args[i];
  }
  return msg;
};

/**
 * Check if argment is an ack.
 *
 * @param {Array} arg
 * @return {Boolean}
 */

const isAck = arg => 105 == arg[0] && 58 == arg[1];
