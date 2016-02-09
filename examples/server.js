require('babel-core/register');

var wagon = require('../lib/index');

var bus = wagon();

bus = bus.bind();
