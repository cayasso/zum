require('babel-core/register');

var zum = require('../lib/index');
var bus = zum();

bus = bus.connect();

bus.listen('GA::10::12345::started', function (msg, fn) {
  console.log('=====>', msg);
  //fn(null, 'RECIBIDO GRACIAS [client 3]');
});


bus.on('reconnect', function () {
  console.log('RECONNECT');
})

bus.on('reconnect', function () {
  console.log('RECONNECT');
})

bus.on('reconnect failed', function () {
  console.log('RECONNECT FAILED');
})


bus.on('reconnecting', function () {
  console.log('RECONNECTING');
})

bus.on('disconnect', function () {
  console.log('DISCONNECT');
})


bus.on('connect', function () {
  console.log('CONNECT');
})

bus.on('end', function () {
  console.log('END');
})


bus.on('error', function () {
  console.log('ERROR');
})
