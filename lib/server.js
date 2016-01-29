'use strict';

/**
 * Module dependencies.
 */

import wildcard from 'wildcard-wrapper';
import { Stream as Parser } from 'amp';
import Emitter from 'eventemitter3';
import Message from 'amp-message';
import topic from './topic';
import debug from 'debug';
import net from 'netly';

const HOST = 'tcp://127.0.0.1:5555';

export default class Server extends Emitter {

  /**
   * Initialize `server`.
   *
   * @param {Object} options
   * @return {Server}
   * @api public
   */

  constructor(options) {
    super();
    const { host = HOST } = options;
    this.host = host;
    this.n = 0;
    this.ids = {};
    this.socks = [];
    this.topics = {};
    this.use(wildcard);
  }

  /**
   * Bind to `port` at `host` and invoke `fn()`.
   *
   * @param {Function} [fn]
   * @return {Server}
   * @api public
   */

  bind(fn) {
    this.srv = net.bind(this.host, fn);
    this.srv.on('connection', this.onconnect.bind(this));
    this.srv.on('error', this.onerror.bind(this));
    return this;
  }

  /**
   * Add `sock` to `server`.
   *
   * @param {Socket} sock
   * @api public
   */

  add(sock) {
    const parser = new Parser();
    this.socks.push(sock);
    sock.pipe(parser);
    parser.on('data', this.ondata(sock));
  }

  /**
   * Remove `sock` from `server`.
   *
   * @param {Socket} sock
   * @api public
   */

  remove(sock) {
    const i = this.socks.indexOf(sock);
    if (!~i) return;
    this.socks.splice(i, 1);
    this.forEachTopic(tp => {
      tp.remove(sock);
    });
  }

  /**
   * Close Server.
   *
   * @return {Server}
   * @api public
   */

  close() {
    this.srv.close();
    return this;
  }

  /**
   * Method to extend Server.
   *
   * @param {Function} fn
   * @param {Object} options
   * @return {Server}
   * @api public
   */

  use(fn, options) {
    fn(this, options)
    return this;
  }

  /**
   * Called upon `sock` connect.
   *
   * @param {Socket} sock
   * @api private
   */

  onconnect(sock) {
    this.connected = true;
    this.add(sock);
    this.emit('connect', sock);
    sock.on('close', this.ondisconnect(sock));
  }

  /**
   * Called upon `sock` close.
   *
   * @param {Socket} sock
   * @api private
   */

  ondisconnect(sock) {
    return () => {
      this.remove(sock);
      sock.removeAllListeners();
      this.emit('disconnect', sock);
    };
  }

  /**
   * Iterate over each topic.
   *
   * @param {Function} fn
   * @api public
   */

  forEachTopic(fn) {
    const topics = this.topics;
    for (let ns in topics) {
      if (false === fn(topics[ns], ns, topics)) break;
    }
  }

  /**
   * Called upon data received.
   *
   * @param {Socket} sock
   * @api private
   */

  ondata(sock) {
    return buf => {
      const msg = new Message(buf);
      let args = msg.args;
      let ev = args[0];
      let tp = null;

      switch (ev) {

        case 'bus::hsk':
          const evts = args[1];
          if (evts) {
            evts.forEach(ns => {
              if (ns) {
                this.wildcard.add(ns);
                tp = this.topics[ns];
              }
              if (!tp) tp = this.topics[ns] = topic.create(ns);
              tp.add(sock);
            });
          }
          break;

        case 'bus::ack':
          const id = args[1];
          const _sock = this.ids[id];
          if (_sock && _sock.writable) {
            _sock.write(buf);
            delete this.ids[id];
          }
          break;

        case 'bus::sub':
          let ns = args[1];
          if (ns) {
            this.wildcard.add(ns);
            tp = this.topics[ns];
          }
          if (!tp) tp = this.topics[ns] = topic.create(ns);
          tp.add(sock);
          break;

        case 'bus::unsub':
          ns = msg.args[1];
          if (ns) {
            this.wildcard.remove(ns);
            tp = this.topics[ns];
          }
          if (tp) tp = tp.remove(sock);
          break;

        case 'bus::pub':
          args.shift();
          ev = args[0];
          tp = this.topics[ev];
          if (tp) tp.broadcast(buf);
          this.emit(...args);
          this.processWildcards(ev, args, 'broadcast');
          break;

        default:
          if (isAck(ev)) {
            this.ids[ev] = sock;
            ev = args[1];
          }
          tp = this.topics[ev];
          if (tp) tp.send(buf);
          this.processWildcards(ev, args, 'send');
          this.emit(...args);
      }
    }
  };

  /**
   * Process wildcard messages.
   *
   * @param {String} ev
   * @param {Array} args
   * @param {String} type
   * @api private
   */

  processWildcards(ev, args, type) {
    this.wildcard.match(ev, (key, segs) => {
      let cb = null;
      let tp = this.topics[key];
      if (!tp) return;
      if (isAck(args[0])) cb = args.shift();
      args.shift();
      args.unshift(segs[1]);
      args.unshift(key);
      if (cb) args.unshift(cb);
      tp[type]((new Message(args)).toBuffer());
    });
  }

  /**
   * Called upon `server` error.
   *
   * @param {Error} err
   * @api private
   */

  onerror(err) {
    debug(err);
    console.error(err);
    this.emit('error', err);
  }

}

/**
 * Check if argment is an ack.
 *
 * @param {Array} arg
 * @return {Boolean}
 */

const isAck = arg => 105 == arg[0] && 58 == arg[1];
