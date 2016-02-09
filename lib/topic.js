'use strict';

/**
 * Module dependencies.
 */

import async from 'async';

export default ns => {

  let n = 0;
  let queue = [];
  let delay = 150;
  let queueing = false;
  let socks = new Set();

  const run = () => {
    queueing = true;
    async.eachSeries(queue, (arr, next) => {
      setTimeout(() => {
        runners[arr[0]](...[arr[1], true]);
        next();
      }, delay);
    }, err => {
      queueing = false;
      queue.length = 0;
    });
  }

  const send = (buf, force) => {
    let sock = [...socks][n++ % socks.size];
    if (sock && sock.writable && !queueing || force && queueing) {
      sock.write(buf);
    } else {
      queue.push(['send', buf]);
    }
  }

  const broadcast = (buf, force) => {
    if (socks.size && !queueing || force && queueing) {
      for (let s of socks) s && s.writable && s.write(buf);
    } else {
      queue.push(['broadcast', buf]);
    }
  }

  const runners = { send, broadcast };
  const add = sock => socks.add(sock);
  const remove = sock => socks.delete(sock);

  return { ...runners, add, remove };
}
