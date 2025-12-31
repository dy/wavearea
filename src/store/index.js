// Store factory - creates storage adapter instances
// Centralizes storage configuration and makes it easy to switch adapters

import { OPFSAdapter } from './opfs.js';

/**
 * Create a storage adapter instance
 * @returns {StoreAdapter} Store adapter instance
 */
export function createStore() {
  // Currently uses OPFS adapter
  // Future: could switch based on:
  // - Feature detection (OPFS availability)
  // - Configuration/environment
  // - User preference
  return new OPFSAdapter();
}

// Export singleton instance for convenience
export default createStore();
