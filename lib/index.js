 'use strict';

/**
 * Module dependencies.
 */

import 'babel-polyfill';
import server from './server';
import client from './client';

export const bind = (...args) => server(...args);
export const connect = (...args) => client(...args);

export default options => ({
  bind: fn => bind(options, fn),
  connect: fn => connect(options, fn)
});
