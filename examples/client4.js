require('babel-core/register');

var zum = require('../lib/index');
var bus = zum();

bus = bus.connect();
bus.listen('GA::10::12345::*', function (seg, msg, fn) {
  console.log('=====>', seg, msg);
  //fn(null, 'RECIBIDO GRACIAS [client 2]');
});
