'use strict';

const NODE_ENV     = process.env.NODE_ENV || 'development';
const APP_PORT     = parseInt(process.env.APP_PORT, 10) || 5000;
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://192.168.1.145:3000'];

module.exports = { NODE_ENV, APP_PORT, CORS_ORIGINS };