require('babel-core/register');

var zum = require('../lib/index');

var bus = zum();

bus = bus.bind();

/**
 * Handle errors.
 */

bus.on('error', (err) => {
  console.error(err);
});

/**
 * Announce connection.
 */

bus.on('listening', (info) => {
  console.log('-----------------------------------------------------');
  console.log(' CONNECTED : ' + info.host);
  console.log(' STARTED   : ' + new Date());
  console.log('-----------------------------------------------------');
});
