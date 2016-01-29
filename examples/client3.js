var wagon = require('../');
var bus = wagon();

bus = bus.connect();

bus.listen('GA::10::12345::started', function (msg, fn) {
  console.log('=====>', msg);
  fn(null, 'RECIBIDO GRACIAS [client 3]');
});
