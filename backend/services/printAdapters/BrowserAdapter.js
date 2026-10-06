/**
 * Browser Print Adapter
 * Returns HTML for browser-based printing (window.print())
 */

const PrintAdapter = require('./PrintAdapter');
const logger = require('../../utils/logger');

class BrowserAdapter extends PrintAdapter {
  /**
   * Validate device configuration
   */
  validateConfig() {
    // Browser adapter doesn't need address validation
    return true;
  }

  /**
   * Print a document (returns HTML for browser)
   */
  async print(job) {
    const { content, options = {} } = job;

    if (!content) {
      throw new Error('No content to print');
    }

    // Return HTML for browser to render
    return {
      success: true,
      html: content,
      requiresBrowser: true
    };
  }

  /**
   * Test printer connectivity (always true for browser)
   */
  async testConnectivity() {
    return true;
  }

  /**
   * Get printer status
   */
  async getStatus() {
    return {
      online: true,
      type: 'browser',
      note: 'Browser printing requires user interaction'
    };
  }
}

module.exports = BrowserAdapter;
