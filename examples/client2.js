require('babel-core/register');

var wagon = require('../lib/index');
var bus = wagon();

bus = bus.connect();

bus.on('connect');

bus.listen('GA::10::12345::*', function (seg, msg, fn) {
  console.log('=====>', seg, msg);
  fn(null, 'RECIBIDO GRACIAS [client 2]');
});
