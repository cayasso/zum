 'use strict';

/**
 * Module dependencies.
 */

import Server from './server';
import Client from './client';

export default options => ({
  bind: fn => (new Server(options)).bind(fn),
  connect: fn => (new Client(options)).connect(fn)
});

export { Server, Client };
