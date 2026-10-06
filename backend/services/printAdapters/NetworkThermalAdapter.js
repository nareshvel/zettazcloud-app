/**
 * Network Thermal Printer Adapter
 * Handles ESC/POS printing over TCP for thermal receipt printers
 */

const net = require('net');
const PrintAdapter = require('./PrintAdapter');
const logger = require('../../utils/logger');

class NetworkThermalAdapter extends PrintAdapter {
  constructor(device) {
    super(device);
    this.connection = null;
  }

  /**
   * Validate device configuration
   */
  validateConfig() {
    if (!this.device.address) {
      throw new Error('Network printer requires address');
    }

    const [host, portStr] = this.device.address.split(':');
    const port = parseInt(portStr, 10) || 9100;

    if (!host) {
      throw new Error('Invalid address format');
    }

    if (port < 1 || port > 65535) {
      throw new Error('Invalid port number');
    }

    return true;
  }

  /**
   * Connect to printer
   */
  async connect() {
    const [host, portStr = '9100'] = this.device.address.split(':');
    const port = parseInt(portStr, 10) || 9100;

    return new Promise((resolve, reject) => {
      this.connection = new net.Socket();
      const timeout = setTimeout(() => {
        this.connection.destroy();
        reject(new Error(`Connection timeout to ${host}:${port}`));
      }, 5000);

      this.connection.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.connection.on('connect', () => {
        clearTimeout(timeout);
        logger.log(`Connected to thermal printer at ${host}:${port}`);
        resolve();
      });

      this.connection.connect(port, host);
    });
  }

  /**
   * Disconnect from printer
   */
  disconnect() {
    if (this.connection) {
      this.connection.end();
      this.connection = null;
    }
  }

  /**
   * Print a document
   */
  async print(job) {
    this.validateConfig();

    const { content, options = {} } = job;

    if (!content) {
      throw new Error('No content to print');
    }

    try {
      await this.connect();

      // Send data
      const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'binary');
      await new Promise((resolve, reject) => {
        this.connection.write(data, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Wait for data to be sent
      await new Promise(resolve => setTimeout(resolve, 500));

      this.disconnect();

      return { success: true };
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }

  /**
   * Test printer connectivity
   */
  async testConnectivity() {
    try {
      await this.connect();
      this.disconnect();
      return true;
    } catch (error) {
      logger.error(`Thermal printer connectivity test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get printer status
   */
  async getStatus() {
    try {
      const connected = await this.testConnectivity();
      return {
        online: connected,
        address: this.device.address,
        type: 'network_thermal'
      };
    } catch (error) {
      return {
        online: false,
        address: this.device.address,
        type: 'network_thermal',
        error: error.message
      };
    }
  }
}

module.exports = NetworkThermalAdapter;
