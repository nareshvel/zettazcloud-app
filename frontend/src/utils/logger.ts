/**
 * Logger utility for conditional console logging.
 * 
 * Usage:
 * import { logger } from '../utils/logger';
 * logger.log('Message', data);
 * logger.warn('Warning message');
 * logger.error('Error message', error);
 */

// Set to true to enable logging in development, false to disable all logs
const DEBUG_MODE = false;

// Check if we're in development environment
const isDev = process.env.NODE_ENV === 'development';

const logger = {
  log: (message: string, ...data: any[]) => {
    // Only log in development mode when DEBUG_MODE is true
    if (isDev && DEBUG_MODE) {
      console.log(message, ...data);
    }
  },
  
  warn: (message: string, ...data: any[]) => {
    // Warnings are shown in development mode even with DEBUG_MODE off
    if (isDev) {
      console.warn(message, ...data);
    }
  },
  
  error: (message: string, ...data: any[]) => {
    // Errors are always logged regardless of environment
    console.error(message, ...data);
  }
};

export { logger };
