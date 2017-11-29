var zum = require('../src/index');
var bus = zum();

bus = bus.connect();

var ids = 0;
setInterval(function (){
  var data =  { id: ids++ };
  console.log('SENDING ===>', data);
  bus.publish('HOLA', 'HOLA');
}, 6000);
