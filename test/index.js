process.env.NODE_ENV = 'test';

import { bind, connect } from '../lib/index';
import zum from '../lib/index';

const host = 'tcp://127.0.0.1:9696';
const server = bind(host);
const client1 = connect(host);
const client2 = connect(host);
const client3 = connect(host);

describe('zum', function () {

  it('should be a function', function () {
    zum.should.be.a.Function;
  });

  it('should expose single methods', function () {
    bind.should.be.a.Function;
    connect.should.be.a.Function;
  });

  it('should have required methods', function () {
    var bus = zum();
    bus.bind.should.be.a.Function;
    bus.connect.should.be.a.Function;
  });

  it('should send and listen to message', function (done) {
    client2.listen('news', msg => {
      msg.should.be.eql('hi');
      done();
    });
    client1.send('news', 'hi');
  });

  it('should send objects', function (done) {
    client2.listen('msg-obj', msg => {
      msg.should.be.eql({ ok: true });
      done();
    });
    client1.send('msg-obj', { ok: true });
  });

  it('should allow ack', function (done) {
    client2.listen('msg-ack', (msg, fn) => {
      msg.should.be.eql({ ok: true });
      fn();
    });
    client1.send('msg-ack', { ok: true }, done);
  });

  it('should listen with wildcard', function (done) {
    client2.listen('msg-lst-wild:*', (ac, msg) => {
      ac.should.be.eql('go');
      msg.should.be.eql('hi');
      done();
    });
    client3.send('msg-lst-wild:go', 'hi');
  });

  it('should only handle one message (round robin)', function (done) {
    client3.listen('msg-one', (ac, msg) => {
      done();
    });
    client2.listen('msg-one', (ac, msg) => {
      done();
    });
    client1.send('msg-one', 'hi');
  });

  it('should only handle one message with wildcard', function (done) {
    client3.listen('msg-hdl-one:*', (ac, msg) => {
      done();
    });
    client2.listen('msg-hdl-one:*', (ac, msg) => {
      done();
    });
    client1.send('msg-hdl-one:hi', 'hi');
  });

  it('should handle wildcard specificity', function (done) {
    client3.listen('msg-spcf:*:*', (ac, msg) => {
      done('Should not handle');
    });
    client2.listen('msg-spcf:*', (ac, msg) => {
      done();
    });
    client1.send('msg-spcf:hola', null);
  });

  it('should unlisten from an event', function (done) {
    client2.listen('msg-rm', (ac, fn) => {
      client2.unlisten('msg-rm');
      fn();
    });
    client2.listen('done', done);
    client1.send('msg-rm', 'hi', (fn) => {
      client1.send('msg-rm', 'hi');
      client1.send('msg-rm', 'hi');
      client1.send('done');
    });
  });

  it('should publish and subscribe to message', function (done) {
    client2.subscribe('msg', msg => {
      msg.should.be.eql('hi');
      done();
    });
    client1.publish('msg', 'hi');
  });

  it('should publish objects', function (done) {
    client2.subscribe('msg-pub-obj', msg => {
      msg.should.be.eql({ ok: true });
      done();
    });
    client1.publish('msg-pub-obj', { ok: true });
  });

  it('should publish to all subscribers', function (done) {
    let n = 0;
    const finish = (ac, msg) => ( 2 <= ++n) && done();
    client3.subscribe('msg-all:hey', finish);
    client2.subscribe('msg-all:hey', finish);
    client1.publish('msg-all:hey', 'hey');
  });

  it('should publish to all subscribers with wildcard', function (done) {
    let n = 0;
    const finish = (ac, msg) => ( 2 <= ++n) && done();
    client3.subscribe('msg-pub-wild:*', finish);
    client2.subscribe('msg-pub-wild:*', finish);
    client1.publish('msg-pub-wild:hi', 'hi');
  });

  it('should unsubscribe from a topic', function (done) {
    const sub = () => {
      client2.unsubscribe('msg-uns', sub);
      done();
    }
    client2.subscribe('msg-uns', sub);
    client1.publish('msg-uns');
    client1.publish('msg-uns');
    client1.publish('msg-uns');
  });

  after(function (done) {
    server.close(done);
  })
});
