require('babel-core/register');

var zum = require('../lib/index');

var bus = zum();

bus = bus.bind();
