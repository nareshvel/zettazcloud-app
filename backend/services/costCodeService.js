/**
 * costCodeService
 * -----------------------------------------------------------------------------
 * Encodes / decodes a "cost code" that jewelry (and other) retailers print on
 * the price tag so that the real cost price is hidden from the customer but
 * readable by staff.
 *
 * The scheme is fully tenant-configurable:
 *   - prefix    : a single marker character the code starts with (e.g. "X")
 *   - suffix    : a single marker character the code ends with    (e.g. "Y")
 *   - digitMap  : mapping of the ten digits 0-9 to letters/characters
 *                 e.g. { "1": "A", "2": "N", ... }
 *   - decimalChar : character used to represent the decimal point (optional)
 *   - repeatChar  : character used to represent a repeated digit (optional,
 *                   avoids revealing repeated numbers, e.g. 55 -> "E*")
 *
 * Example (digitMap 1->A,2->N,3->C,4->D,5->E,6->F,7->G,8->H,9->I,0->O):
 *   encode(125.50) with prefix X / suffix Y / decimalChar "." ->  "XANE.EOY"
 *   decode("XANE.EOY") -> 125.50
 *
 * This module has NO database dependency so it can be unit-tested in isolation.
 * Tenant settings are loaded by the caller (see costCode.routes.js) and passed
 * in as `config`.
 */

'use strict';

const DEFAULT_DIGIT_MAP = {
  '1': 'A', '2': 'N', '3': 'C', '4': 'D', '5': 'E',
  '6': 'F', '7': 'G', '8': 'H', '9': 'I', '0': 'O',
};

const DEFAULTS = {
  enabled: false,
  prefix: 'X',
  suffix: 'Y',
  decimalChar: '.',
  repeatChar: '',        // empty = do not use repeat compression
  digitMap: DEFAULT_DIGIT_MAP,
};

/**
 * Merge tenant config over defaults and validate it.
 * @param {object} config
 * @returns {object} normalized config
 * @throws {Error} when the config is invalid
 */
function normalizeConfig(config = {}) {
  const cfg = {
    ...DEFAULTS,
    ...config,
    digitMap: { ...DEFAULT_DIGIT_MAP, ...(config.digitMap || {}) },
  };

  // Validate digit map: exactly digits 0-9, values must be single, unique, non-numeric chars.
  const digits = Object.keys(cfg.digitMap).sort().join('');
  if (digits !== '0123456789') {
    throw new Error('costCode: digitMap must define exactly the digits 0-9');
  }
  const values = Object.values(cfg.digitMap);
  values.forEach((v) => {
    if (typeof v !== 'string' || v.length !== 1) {
      throw new Error('costCode: each digitMap value must be a single character');
    }
    if (/[0-9]/.test(v)) {
      throw new Error('costCode: digitMap values must not be numeric');
    }
  });
  if (new Set(values).size !== values.length) {
    throw new Error('costCode: digitMap values must be unique');
  }

  ['prefix', 'suffix'].forEach((k) => {
    if (typeof cfg[k] !== 'string' || cfg[k].length !== 1) {
      throw new Error(`costCode: ${k} must be a single character`);
    }
  });

  // Ensure marker/decimal/repeat chars don't collide with digit letters.
  const reserved = new Set(values);
  ['prefix', 'suffix', 'decimalChar', 'repeatChar'].forEach((k) => {
    const ch = cfg[k];
    if (ch && reserved.has(ch)) {
      throw new Error(`costCode: ${k} ("${ch}") collides with a digitMap value`);
    }
  });

  return cfg;
}

/**
 * Encode a numeric cost price into the tag code string.
 * @param {number|string} amount  e.g. 125.5
 * @param {object} config         tenant cost-code settings
 * @returns {string} encoded tag code, e.g. "XANE.EOY"
 */
function encode(amount, config = {}) {
  const cfg = normalizeConfig(config);
  if (amount === null || amount === undefined || amount === '') {
    throw new Error('costCode: amount is required');
  }
  const num = Number(amount);
  if (Number.isNaN(num) || num < 0) {
    throw new Error('costCode: amount must be a non-negative number');
  }

  // Keep up to 2 decimals; trim trailing zeros in the decimal part only.
  let str = num.toFixed(2);
  str = str.replace(/\.00$/, '');           // 125.00 -> 125
  str = str.replace(/(\.\d)0$/, '$1');      // 125.50 -> 125.5

  let out = '';
  let prevChar = null;
  for (const ch of str) {
    if (ch === '.') {
      out += cfg.decimalChar;
      prevChar = null;
      continue;
    }
    const mapped = cfg.digitMap[ch];
    if (cfg.repeatChar && mapped === prevChar) {
      out += cfg.repeatChar;
    } else {
      out += mapped;
      prevChar = mapped;
    }
  }
  return `${cfg.prefix}${out}${cfg.suffix}`;
}

/**
 * Decode a tag code back into a numeric cost price.
 * @param {string} code    e.g. "XANE.EOY"
 * @param {object} config  tenant cost-code settings
 * @returns {number} decoded cost price
 */
function decode(code, config = {}) {
  const cfg = normalizeConfig(config);
  if (typeof code !== 'string' || code.length < 3) {
    throw new Error('costCode: code is invalid');
  }
  if (code[0] !== cfg.prefix || code[code.length - 1] !== cfg.suffix) {
    throw new Error('costCode: code does not have the expected prefix/suffix');
  }

  const body = code.slice(1, -1);
  const reverse = {};
  Object.entries(cfg.digitMap).forEach(([d, letter]) => { reverse[letter] = d; });

  let out = '';
  let prevDigit = null;
  for (const ch of body) {
    if (cfg.decimalChar && ch === cfg.decimalChar) {
      out += '.';
      prevDigit = null;
      continue;
    }
    if (cfg.repeatChar && ch === cfg.repeatChar) {
      if (prevDigit === null) throw new Error('costCode: repeat char with no preceding digit');
      out += prevDigit;
      continue;
    }
    const digit = reverse[ch];
    if (digit === undefined) {
      throw new Error(`costCode: unknown character "${ch}" in code`);
    }
    out += digit;
    prevDigit = digit;
  }

  const value = Number(out);
  if (Number.isNaN(value)) throw new Error('costCode: decoded value is not a number');
  return value;
}

/**
 * Derived-pricing helpers for the non-weight pricing flow used by this client:
 *   cost_price    = purchase_price * (1 + handling_cost_pct/100)
 *   selling_price = cost_price     * (1 + markup_pct/100)
 */
function computeCostPrice(purchasePrice, handlingCostPct = 0) {
  const p = Number(purchasePrice);
  const h = Number(handlingCostPct) || 0;
  if (Number.isNaN(p) || p < 0) throw new Error('costCode: purchasePrice invalid');
  return round2(p * (1 + h / 100));
}

function computeSellingPrice(costPrice, markupPct = 0) {
  const c = Number(costPrice);
  const m = Number(markupPct) || 0;
  if (Number.isNaN(c) || c < 0) throw new Error('costCode: costPrice invalid');
  return round2(c * (1 + m / 100));
}

/** Convenience: run the full purchase -> cost -> selling pipeline. */
function derivePricing({ purchasePrice, handlingCostPct = 0, markupPct = 0 }) {
  const costPrice = computeCostPrice(purchasePrice, handlingCostPct);
  const sellingPrice = computeSellingPrice(costPrice, markupPct);
  return { purchasePrice: round2(purchasePrice), handlingCostPct, costPrice, markupPct, sellingPrice };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = {
  DEFAULTS,
  DEFAULT_DIGIT_MAP,
  normalizeConfig,
  encode,
  decode,
  computeCostPrice,
  computeSellingPrice,
  derivePricing,
};
