import pino from 'pino';
import type { AppConfig } from './config.js';

export function createLogger(config: Pick<AppConfig, 'logLevel'>) {
  return pino({
    level: config.logLevel,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type AppLogger = ReturnType<typeof createLogger>;
