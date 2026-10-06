/**
 * Print Adapter Factory
 * Creates appropriate adapter instances based on device type
 */

const PrintAdapter = require('./PrintAdapter');
const NetworkThermalAdapter = require('./NetworkThermalAdapter');
const LabelZplAdapter = require('./LabelZplAdapter');
const BrowserAdapter = require('./BrowserAdapter');
const logger = require('../../utils/logger');

/**
 * Device type to adapter mapping
 */
const ADAPTER_MAP = {
  'thermal_receipt': NetworkThermalAdapter,
  'laser': BrowserAdapter, // TODO: Implement PDF adapter for laser printers
  'inkjet': BrowserAdapter, // TODO: Implement PDF adapter for inkjet printers
  'label_zebra_zpl': LabelZplAdapter,
  'label_tsc_tspl': LabelZplAdapter, // TODO: Implement TSPL adapter
  'label_dymo': LabelZplAdapter, // TODO: Implement Dymo adapter
  'label_brother': LabelZplAdapter, // TODO: Implement Brother adapter
  'pdf_generator': BrowserAdapter // TODO: Implement PDF generator adapter
};

/**
 * Create adapter instance for a device
 * @param {Object} device - Printer device configuration
 * @returns {PrintAdapter} Adapter instance
 */
function createAdapter(device) {
  if (!device || !device.device_type) {
    throw new Error('Invalid device configuration');
  }

  const AdapterClass = ADAPTER_MAP[device.device_type];

  if (!AdapterClass) {
    throw new Error(`No adapter available for device type: ${device.device_type}`);
  }

  const adapter = new AdapterClass(device);

  // Validate configuration
  if (!adapter.validateConfig()) {
    throw new Error('Device configuration validation failed');
  }

  logger.log(`Created ${device.device_type} adapter for device ${device.id}`);
  return adapter;
}

/**
 * Get list of supported device types
 * @returns {Array<string>} Supported device types
 */
function getSupportedDeviceTypes() {
  return Object.keys(ADAPTER_MAP);
}

/**
 * Check if device type is supported
 * @param {string} deviceType - Device type to check
 * @returns {boolean} True if supported
 */
function isDeviceTypeSupported(deviceType) {
  return ADAPTER_MAP.hasOwnProperty(deviceType);
}

module.exports = {
  createAdapter,
  getSupportedDeviceTypes,
  isDeviceTypeSupported
};
