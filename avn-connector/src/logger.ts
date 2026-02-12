import { createLogger, format, transports, Logger } from 'winston';

const { combine, timestamp, printf, errors, colorize } = format;

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const level = process.env.ENVIRONMENT === 'prod' ? 'http' : 'debug';

const logFormat = (requestId: string | null) =>
  combine(
    timestamp(),
    printf(info => {
      const splat = info[Symbol.for('splat')] || [];
      const stack = info.stack;
      const data = info.data;
      const dataStr = data ? `\n${JSON.stringify(data)}` : '';
      const context = Array.isArray(splat) ? splat[0]?.context : '';

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
    errors({ stack: true })
  );

const createLoggerInstance = (requestId: string | null): Logger =>
  createLogger({
    level,
    levels,
    format: logFormat(requestId),
    transports: [
      new transports.Console({
        format: combine(colorize({ all: true }), logFormat(requestId))
      })
    ]
  });

let loggerInstance: Logger = createLoggerInstance(null);

const setRequestId = (requestId: string) => {
  loggerInstance = createLoggerInstance(requestId);
};

const log = (level: string, message: string, data?: any) => {
  loggerInstance.log(level, message, { data });
};

const info = (message: any, data?: any) => log('info', message, data);
const error = (message: any, data?: any) => log('error', message, data);
const warn = (message: any, data?: any) => log('warn', message, data);
const debug = (message: any, data?: any) => log('debug', message, data);

const logger = {
  setRequestId,
  info,
  error,
  warn,
  debug
};

export default logger;
