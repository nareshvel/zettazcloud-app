/**
 * marketRateFetcherService
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches live international spot prices from goldapi.io and converts them to
 * the org's currency + weight unit, applying a configurable local premium %.
 *
 * goldapi.io endpoint:
 *   GET https://www.goldapi.io/api/{symbol}/{currency}
 *   symbol  : XAU (Gold) | XAG (Silver) | XPT (Platinum) | XPD (Palladium)
 *   currency: any ISO 4217 code — INR, USD, AED, GBP, EUR, etc.
 *   Returns : price_gram_24k (already in target currency per gram)
 *
 * Weight unit conversions (from grams):
 *   g    → 1
 *   oz   → 1 / 31.1035  (troy ounce)
 *   tola → 1 / 11.6638  (1 tola = 11.6638g, India/Pakistan/Gulf)
 *   baht → 1 / 15.244   (1 baht = 15.244g, Thailand)
 *   kg   → 1 / 1000
 *
 * Purity conversion from 24K spot:
 *   22K → × (22/24) = × 0.91667
 *   18K → × (18/24) = × 0.75
 *   14K → × (14/24) = × 0.58333
 *   Silver 999 → × 0.999
 *   Silver 925 → × 0.925
 *   Platinum 950 → × 0.95
 *   etc.
 */

'use strict';

const https = require('https');

/* ─── weight unit → grams factor ─────────────────────────────────────────── */
const GRAMS_PER_UNIT = {
  g:    1,
  oz:   31.1035,
  tola: 11.6638,
  baht: 15.244,
  kg:   1000,
};

/* ─── goldapi.io symbols ─────────────────────────────────────────────────── */
const METAL_SYMBOL = {
  Gold:      'XAU',
  Silver:    'XAG',
  Platinum:  'XPT',
  Palladium: 'XPD',
};

/* ─── standard purities to auto-generate ────────────────────────────────── */
const PURITIES = {
  Gold: [
    { label: '24K',  pct: 1.0    },
    { label: '22K',  pct: 22/24  },
    { label: '18K',  pct: 18/24  },
    { label: '14K',  pct: 14/24  },
    { label: '10K',  pct: 10/24  },
  ],
  Silver: [
    { label: '999',  pct: 0.999  },
    { label: '925',  pct: 0.925  },
    { label: '800',  pct: 0.800  },
  ],
  Platinum: [
    { label: '950',  pct: 0.950  },
    { label: '900',  pct: 0.900  },
  ],
  Palladium: [
    { label: '999',  pct: 0.999  },
    { label: '950',  pct: 0.950  },
  ],
};

/* ─── HTTP helper ────────────────────────────────────────────────────────── */
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`JSON parse error: ${body.slice(0, 200)}`)); }
        } else {
          reject(new Error(`goldapi.io returned HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('goldapi.io request timed out')); });
  });
}

/* ─── round to 2 dp ─────────────────────────────────────────────────────── */
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Fetch spot rates for one metal in the target currency.
 * Returns price_gram_24k (per gram, 24K, in target currency) and price_gram_buy if present.
 */
async function fetchSpotForMetal(apiKey, metal, currencyCode) {
  const symbol = METAL_SYMBOL[metal];
  if (!symbol) throw new Error(`Unknown metal: ${metal}`);
  const url = `https://www.goldapi.io/api/${symbol}/${currencyCode}`;
  const data = await httpsGet(url, {
    'x-access-token': apiKey,
    'Content-Type': 'application/json',
  });
  if (data.error) throw new Error(`goldapi.io error for ${metal}: ${data.error}`);
  return {
    priceGram24k:    Number(data.price_gram_24k  || 0),
    priceGramBuy:    data.prev_close_price ? Number(data.prev_close_price) / 31.1035 : null,
    spotPerTroyOz:   Number(data.price || 0),
    currency:        data.currency,
    timestamp:       data.timestamp,
    exchange:        data.exchange,
  };
}

/**
 * Main export: fetch all configured metals, generate purity matrix, apply local premium.
 *
 * @param {object} opts
 * @param {string}   opts.apiKey           goldapi.io API key
 * @param {string}   opts.currencyCode     org currency e.g. 'INR', 'USD'
 * @param {string}   opts.weightUnit       'g' | 'oz' | 'tola' | 'baht' | 'kg'
 * @param {number}   opts.localPremiumPct  % to add over spot (local duties/premium)
 * @param {string[]} [opts.metals]         defaults to ['Gold','Silver','Platinum']
 * @returns {Promise<FetchResult>}
 */
async function fetchMarketRates(opts) {
  const {
    apiKey,
    currencyCode = 'USD',
    weightUnit   = 'g',
    localPremiumPct = 0,
    metals = ['Gold', 'Silver', 'Platinum'],
  } = opts;

  if (!apiKey) throw new Error('goldapi.io API key not configured. Add it in Metal Rates → Settings.');

  const gramsPerUnit = GRAMS_PER_UNIT[weightUnit] || 1;
  const premiumFactor = 1 + (Number(localPremiumPct) / 100);

  const results = [];
  const errors  = [];

  for (const metal of metals) {
    try {
      const spot = await fetchSpotForMetal(apiKey, metal, currencyCode);
      const purities = PURITIES[metal] || [{ label: '999', pct: 0.999 }];

      for (const p of purities) {
        // price_gram_24k is already per gram for 24K gold in target currency
        // For other purities: multiply by purity ratio
        const ratePerGram  = spot.priceGram24k * p.pct * premiumFactor;
        const buyPerGram   = spot.priceGramBuy ? spot.priceGramBuy * p.pct * premiumFactor : null;

        // Convert to org weight unit
        const ratePerUnit  = ratePerGram * gramsPerUnit;
        const buyPerUnit   = buyPerGram  ? buyPerGram  * gramsPerUnit : null;

        results.push({
          metal,
          purityLabel:  p.label,
          purityPct:    p.pct * 100,
          ratePerGram:  r2(ratePerGram),   // always stored per gram in DB
          buyRatePerGram: buyPerGram ? r2(buyPerGram) : null,
          ratePerUnit:  r2(ratePerUnit),   // for display in org's weight unit
          buyRatePerUnit: buyPerUnit ? r2(buyPerUnit) : null,
          spotPerTroyOz: spot.spotPerTroyOz,
          currency:     currencyCode,
          weightUnit,
          premiumPct:   localPremiumPct,
          fetchedAt:    new Date().toISOString(),
        });
      }
    } catch (e) {
      errors.push({ metal, error: e.message });
    }
  }

  return { rates: results, errors, fetchedAt: new Date().toISOString() };
}

module.exports = { fetchMarketRates, GRAMS_PER_UNIT, PURITIES, METAL_SYMBOL };
