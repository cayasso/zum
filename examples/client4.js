var zum = require('../src/index');
var bus = zum();

bus = bus.connect();
bus.subscribe('HOLA', function (seg, msg, fn) {
  console.log('=====>', seg, msg);
  //fn(null, 'RECIBIDO GRACIAS [client 2]');
})
