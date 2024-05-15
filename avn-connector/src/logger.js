const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const timestamp = format.timestamp();
const errors = format.errors({ stack: true });

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = process.env.ENVIRONMENT === 'prod' ? 'http' : 'debug';

const logFormat = (requestId) => format.combine(
  timestamp,
  format.printf((info) => {
    const splat = info[Symbol.for('splat')] || {};
    const stack = info.stack;
    const data = info.data;
    const dataStr = data ? `\n${JSON.stringify(data)}` : '';
    const context = splat[0]?.context || info.stack?.[0] || '';

    return (
      `${info.timestamp} ` +
      `${requestId ? `[Request ID: ${requestId}] ` : ''}` +
      `${info.level}: ` +
      `${info.message} ` +
      `${context ? `${context} ` : ''}` +
      `${stack instanceof Array ? '' : stack || ''}` +
      `${dataStr}`
    );
  }),
  errors
);

const createLoggerInstance = (requestId) => createLogger({
  level,
  levels,
  format: logFormat(requestId),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        logFormat(requestId)
      )
    }),
    new DailyRotateFile({
      filename: 'application.log',
      dirname: 'logs',
      frequency: '1d',
      maxSize: '20m'
    })
  ]
});

let loggerInstance = createLoggerInstance(null);

const setRequestId = (requestId) => {
  loggerInstance = createLoggerInstance(requestId);
};

const log = (level, message, data) => {
  loggerInstance.log(level, message, { data });
};

const info = (message, data) => log('info', message, data);
const error = (message, data) => log('error', message, data);
const warn = (message, data) => log('warn', message, data);
const debug = (message, data) => log('debug', message, data);

const logger = {
  setRequestId,
  info,
  error,
  warn,
  debug,
};

module.exports = logger;
