'use strict';

/**
 * Module dependencies.
 */

import { HSK, SUB, UNS, PUB, ACK, HOST } from './constants';
import wildcardCreator from 'wildcard-wrapper';
import { Stream as Parser } from 'amp';
import Emitter from 'eventemitter3';
import Message from 'amp-message';
import createTopic from './topic';
import debug from 'debug';
import net from 'netly';

export default (options = {}, fn) => {

  const wildcard = wildcardCreator();
  const acks = {};
  const topics = {};
  const { host = HOST } = options;
  const emitter = new Emitter();
  const server = net.bind(host, fn);
  const isAck = (arg) => 105 == arg[0] && 58 == arg[1];

  const topic = (ns, sock, tp) => {
    if (ns) {
      wildcard.add(ns);
      tp = topics[ns];
    }
    tp = tp || (topics[ns] = createTopic(ns));
    tp.add(sock);
  }

  const onerror = (err) => {
    debug(err);
    console.error(err);
    emitter.emit('error', err);
  }

  const onlistening = () => {
    emitter.emit('listening', { host });
  }

  const onconnect = sock => {
    const parser = new Parser();
    sock.pipe(parser);
    parser.on('data', ondata(sock));
    emitter.emit('connect', sock);
    sock.on('close', ondisconnect(sock));
  }

  const ondisconnect = sock => () => {
    Object.keys(topics).map(k => topics[k].remove(sock));
    sock.removeAllListeners();
    emitter.emit('disconnect', sock);
  }

  const ondata = sock => buf => {
    let { args } = new Message(buf);
    let ev = args[0];
    let ns = args[1];
    let tp = null;

    switch (ev) {

      case HSK:
        const events = ns || [];
        events.forEach(ns => topic(ns, sock));
        break;

      case ACK:
        const _sock = acks[ns];
        if (_sock && _sock.writable) {
          _sock.write(buf);
          delete acks[ns];
        }
        break;

      case SUB:
        topic(ns, sock);
        break;

      case UNS:
        if (ns) {
          wildcard.remove(ns);
          tp = topics[ns];
        }
        tp = tp || tp.remove(sock);
        break;

      case PUB:
        args.shift();
        ev = args[0];
        tp = topics[ev];
        if (tp) tp.broadcast(buf);
        emitter.emit(...args);
        processWildcards(ev, args, 'broadcast');
        break;

      default:
        if (isAck(ev)) {
          acks[ev] = sock;
          ev = ns;
        }
        tp = topics[ev];
        if (tp) tp.send(buf);
        else processWildcards(ev, args, 'send');
        emitter.emit(...args);
    }
  }

  const processWildcards = (ev, args, type) => {
    wildcard.match(ev, (key, segs) => {
      var cb = null;
      var tp = topics[key];
      if (!tp) return;
      if (isAck(args[0])) cb = args.shift();
      args.shift();
      args.unshift(segs[1]);
      args.unshift(key);
      if (cb) args.unshift(cb);
      tp[type]((new Message(args)).toBuffer());
    });
  }

  server.on('listening', onlistening);
  server.on('connection', onconnect);
  server.on('error', onerror);

  return Object.assign(emitter, { close: server.close });
}
