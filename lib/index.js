 'use strict';

/**
 * Module dependencies.
 */

import 'babel-polyfill';
import server from './server';
import client from './client';

export default options => ({
  bind: fn => server(options, fn),
  connect: fn => client(options, fn)
});
