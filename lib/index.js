 'use strict';

/**
 * Module dependencies.
 */

import 'babel-polyfill';
import server from './server';
import client from './client';

const wagon = options => ({
  bind: fn => server(options, fn),
  connect: fn => client(options, fn)
});

export default wagon;
