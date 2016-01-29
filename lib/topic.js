'use strict';

/**
 * Module dependencies.
 */

import async from 'async';

export default class Topic {

  /**
   * Initialize `topic`.
   *
   * @param {String} ns
   * @return {Topic}
   * @api public
   */

  constructor(ns) {
    this.n = 0;
    this.ns = ns;
    this.delay = 150;
    this.socks = [];
    this.queue = [];
    this.queueing = false;
  }

  /**
   * Add socket to `topic`.
   *
   * @param {Socket} sock
   * @api public
   */

  add(sock) {
    var l = this.socks.length;
    var i = this.socks.indexOf(sock);
    if (!~i) this.socks.push(sock);
    if (!l) this.exec();
  }

  /**
   * Execute queue.
   *
   * @api private
   */

  exec() {
    this.queueing = true;
    async.eachSeries(this.queue, (arr, next) => {
      setTimeout(() => {
        this[arr[0]](...[arr[1], true]);
        next();
      }, this.delay);
    }, err => {
      this.queueing = false;
      this.queue.length = 0;
    });
  }

  /**
   * Remove socket from `topic`.
   *
   * @param {Socket} sock
   * @api public
   */

  remove(sock) {
    const i = this.socks.indexOf(sock);
    if (~i) this.socks.splice(i, 1);
  }

  /**
   * Send message round-robin.
   *
   * @param {Buffer} buf
   * @api public
   */

  send(buf, force) {
    const socks = this.socks;
    let len = socks.length;
    let sock = socks[this.n++ % len];
    if (sock && sock.writable && !this.queueing || force && this.queueing) {
      sock.write(buf);
    } else {
      this.queue.push(['send', buf]);
    }
  }

  /**
   * Send message round-robin.
   *
   * @param {Buffer} buf
   * @api public
   */

  broadcast(buf, force) {
    let i = 0;
    let sock = null;
    let socks = this.socks;
    var len = socks.length;
    if (len && !this.queueing || force && this.queueing) {
      for (i = 0; i < len; ++i) {
        sock = socks[i];
        if (sock && sock.writable) sock.write(buf);
      }
    } else {
      this.queue.push(['broadcast', buf]);
    }
  }

}
