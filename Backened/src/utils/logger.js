'use strict';

const isDev = (process.env.NODE_ENV || 'development') === 'development';

const COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
const RESET  = '\x1b[0m';

function log(level, message, meta) {
  if (!isDev && level === 'debug') return;

  const ts     = new Date().toISOString();
  const label  = isDev
    ? `${COLORS[level]}[${level.toUpperCase()}]${RESET}`
    : `[${level.toUpperCase()}]`;
  const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line    = `${ts} ${label} ${message}${metaStr}`;

  if (level === 'error') process.stderr.write(line + '\n');
  else                   process.stdout.write(line + '\n');
}

const logger = {
  error: (message, meta = {}) => log('error', message, meta),
  warn:  (message, meta = {}) => log('warn',  message, meta),
  info:  (message, meta = {}) => log('info',  message, meta),
  debug: (message, meta = {}) => log('debug', message, meta),
  // Morgan-compatible write stream
  stream: { write: (message) => log('info', message.trimEnd(), {}) },
};

module.exports = { logger };