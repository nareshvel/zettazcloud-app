/**
 * Simple in-memory cache service with TTL support
 */
class CacheService {
  constructor() {
    this.cache = {};
    this.DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // Run garbage collection every minute to clean expired items
    setInterval(() => this.cleanExpiredItems(), 60 * 1000);
  }

  /**
   * Get an item from the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found/expired
   */
  get(key) {
    const item = this.cache[key];
    
    if (!item) {
      return undefined;
    }
    
    // Check if item is expired
    if (item.expiry && item.expiry < Date.now()) {
      delete this.cache[key];
      return undefined;
    }
    
    return item.value;
  }

  /**
   * Set an item in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to store
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = this.DEFAULT_TTL) {
    const expiry = ttl ? Date.now() + ttl : null;
    
    this.cache[key] = {
      value,
      expiry
    };
  }

  /**
   * Delete an item from the cache
   * @param {string} key - Cache key
   */
  delete(key) {
    delete this.cache[key];
  }

  /**
   * Delete all items whose key starts with the given prefix
   * @param {string} prefix - Key prefix to match
   * @returns {number} Number of items deleted
   */
  deleteByPrefix(prefix) {
    let deleted = 0;
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(prefix)) {
        delete this.cache[key];
        deleted++;
      }
    });
    return deleted;
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this.cache = {};
  }

  /**
   * Clean expired cache items
   * @private
   */
  cleanExpiredItems() {
    const now = Date.now();
    
    Object.keys(this.cache).forEach(key => {
      const item = this.cache[key];
      if (item.expiry && item.expiry < now) {
        delete this.cache[key];
      }
    });
  }

  /**
   * Get or compute a value with a key generator and value factory function
   * @param {Function} keyFn - Function that generates a cache key
   * @param {Function} valueFn - Async function that produces the value if not cached
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @returns {Promise<*>} The cached or computed value
   */
  async getOrCompute(keyFn, valueFn, ttl = this.DEFAULT_TTL) {
    const key = keyFn();
    const cachedValue = this.get(key);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    const value = await valueFn();
    this.set(key, value, ttl);
    return value;
  }
}

// Create a singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
