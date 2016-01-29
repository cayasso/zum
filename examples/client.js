var wagon = require('../');
var bus = wagon();

bus = bus.connect();

var ids = 0;
setInterval(function (){
  var data =  { id: ids++ };
  console.log('SENDING ===>', data);
  bus.send('GA::10::12345::started', data, function () {
    console.log('CALLED', arguments);
  });
}, 3000);