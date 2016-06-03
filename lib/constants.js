'use strict';

/**
* Module dependencies.
*/

const NODE_ENV = process.env.NODE_ENV;
const REAL_HOST = 'tcp://127.0.0.1:5555';
const TEST_HOST = 'tcp://127.0.0.1:4444';
export const SUB = 'SUB';
export const UNS = 'UNS';
export const PUB = 'PUB';
export const HSK = 'HSK';
export const ACK = 'ACK';
export const SEND = 'send';
export const BROADCAST = 'broadcast';
export const HOST = (NODE_ENV === 'test') ? TEST_HOST : REAL_HOST;
