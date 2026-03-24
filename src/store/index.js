import { OPFSAdapter } from './opfs.js';
import { IDBAdapter } from './idb.js';
import { MemoryAdapter } from './memory.js';

const adapters = { opfs: OPFSAdapter, idb: IDBAdapter, memory: MemoryAdapter }

function detectAdapter() {
  // OPFS with createWritable (Chrome, Firefox — not Safari)
  if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
    try { if (FileSystemFileHandle.prototype.createWritable) return 'opfs' } catch {}
  }
  // IndexedDB fallback (Safari, older browsers)
  if (typeof indexedDB !== 'undefined') return 'idb'
  return 'memory'
}

export function createStore(type) {
  if (!type) type = detectAdapter()
  if (!adapters[type]) throw Error('Unknown store: ' + type)
  return new adapters[type]()
}

export { OPFSAdapter, IDBAdapter, MemoryAdapter }
