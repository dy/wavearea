// Store factory — creates storage adapter by type
// Adapters: 'opfs' (default), 'idb', 'memory'

import { OPFSAdapter } from './opfs.js';
import { IDBAdapter } from './idb.js';
import { MemoryAdapter } from './memory.js';

const adapters = { opfs: OPFSAdapter, idb: IDBAdapter, memory: MemoryAdapter }

export function createStore(type = 'opfs') {
  let Adapter = adapters[type]
  if (!Adapter) throw Error('Unknown store type: ' + type)
  return new Adapter()
}

export { OPFSAdapter, IDBAdapter, MemoryAdapter }

// default singleton
export default createStore()
