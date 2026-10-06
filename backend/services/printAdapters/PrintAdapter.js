/**
 * Base Print Adapter Interface
 * All printer adapters must implement this interface
 */

class PrintAdapter {
  /**
   * Initialize the adapter with device configuration
   * @param {Object} device - Printer device configuration
   */
  constructor(device) {
    this.device = device;
  }

  /**
   * Print a document
   * @param {Object} job - Print job data
   * @param {Buffer|string} job.content - Content to print
   * @param {Object} job.options - Print options
   * @returns {Promise<Object>} Result with success status
   */
  async print(job) {
    throw new Error('print() must be implemented by subclass');
  }

  /**
   * Test printer connectivity
   * @returns {Promise<boolean>} True if printer is reachable
   */
  async testConnectivity() {
    throw new Error('testConnectivity() must be implemented by subclass');
  }

  /**
   * Get printer status
   * @returns {Promise<Object>} Printer status information
   */
  async getStatus() {
    throw new Error('getStatus() must be implemented by subclass');
  }

  /**
   * Validate device configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    throw new Error('validateConfig() must be implemented by subclass');
  }
}

module.exports = PrintAdapter;
