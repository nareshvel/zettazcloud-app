/**
 * Simple logger module
 */
const logger = {
  debug: (message, ...args) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

module.exports = logger;
