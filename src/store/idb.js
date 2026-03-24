// IndexedDB storage adapter

import { sortFiles, sanitizeFilename, updateFileList, fileMeta } from './adapter.js';

const DB_NAME = 'wavearea-store', DB_VER = 1, FILES = 'files', META = 'metadata'

export class IDBAdapter {
  constructor() { this.db = null }

  async init() {
    if (this.db) return
    this.db = await new Promise((res, rej) => {
      let r = indexedDB.open(DB_NAME, DB_VER)
      r.onupgradeneeded = () => { let db = r.result; [FILES, META].forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s) }) }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }

  async getFiles(opts = {}) { await this.init(); return sortFiles(await this.#get(META, 'files') || [], opts) }

  async getFile(id) {
    await this.init()
    let d = await this.#get(FILES, id)
    if (!d) throw Object.assign(Error('Not found: ' + id), { name: 'NotFoundError' })
    return new File([d.blob], d.name || 'audio', { type: d.type || '' })
  }

  async hasFile(id) {
    await this.init()
    let files = await this.#get(META, 'files') || []
    if (!files.some(f => f.id === id)) return false
    try { await this.#get(FILES, id); return true } catch { return false }
  }

  async addFile(file, extra = {}) {
    await this.init()
    let id = `${Date.now()}-${sanitizeFilename(file.name || 'audio')}`
    // Materialize to ArrayBuffer — WebKit IDB can't structured-clone File/Blob objects
    let buf = await file.arrayBuffer()
    await this.#put(FILES, id, { blob: buf, name: file.name, type: file.type })
    let files = await this.#get(META, 'files') || []
    await this.#put(META, 'files', updateFileList(files, fileMeta(file, id, extra)))
    return id
  }

  async updateFile(id, file, extra = {}) {
    await this.init()
    let buf = await file.arrayBuffer()
    await this.#put(FILES, id, { blob: buf, name: file.name, type: file.type })
    let files = await this.#get(META, 'files') || []
    let i = files.findIndex(f => f.id === id)
    if (i !== -1) { files[i] = { ...files[i], size: file.size, type: file.type, ...extra, modified: Date.now() }; await this.#put(META, 'files', files) }
  }

  async deleteFile(id) {
    await this.init()
    let files = await this.#get(META, 'files') || []
    await this.#put(META, 'files', files.filter(f => f.id !== id))
    await this.#del(FILES, id)
  }

  async clearAll() { await this.init(); await this.#clear(FILES); await this.#put(META, 'files', []) }

  async getStoreInfo() {
    if (!navigator.storage?.estimate) return null
    let e = await navigator.storage.estimate()
    return { usage: e.usage, quota: e.quota, usagePercent: (e.usage / e.quota * 100).toFixed(2) }
  }

  #tx(s, m = 'readonly') { return this.db.transaction(s, m).objectStore(s) }
  #get(s, k) { return new Promise((r, j) => { let q = this.#tx(s).get(k); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) }) }
  #put(s, k, v) { return new Promise((r, j) => { let q = this.#tx(s, 'readwrite').put(v, k); q.onsuccess = () => r(); q.onerror = () => j(q.error) }) }
  #del(s, k) { return new Promise((r, j) => { let q = this.#tx(s, 'readwrite').delete(k); q.onsuccess = () => r(); q.onerror = () => j(q.error) }) }
  #clear(s) { return new Promise((r, j) => { let q = this.#tx(s, 'readwrite').clear(); q.onsuccess = () => r(); q.onerror = () => j(q.error) }) }
}
