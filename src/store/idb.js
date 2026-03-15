// IndexedDB storage adapter for audio files
// Broader compatibility than OPFS — works in all modern browsers + workers

import { StoreAdapter, sortFiles, sanitizeFilename } from './adapter.js';

const DB_NAME = 'wavearea-store';
const DB_VERSION = 1;
const FILES_STORE = 'files';
const META_STORE = 'metadata';

export class IDBAdapter extends StoreAdapter {
  constructor() {
    super();
    this.db = null;
  }

  async init() {
    if (this.db) return;
    this.db = await new Promise((resolve, reject) => {
      let req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        let db = req.result;
        if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE);
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getFiles(options = {}) {
    await this.init();
    let files = await this.#get(META_STORE, 'files');
    return sortFiles(files || [], options);
  }

  async getFile(fileId) {
    await this.init();
    let data = await this.#get(FILES_STORE, fileId);
    if (!data) throw Object.assign(Error('File not found: ' + fileId), { name: 'NotFoundError' });
    return new File([data.blob], data.name || 'audio', { type: data.type || '' });
  }

  async hasFile(fileId) {
    await this.init();
    let files = await this.#get(META_STORE, 'files') || [];
    if (!files.some(f => f.id === fileId)) return false;
    try { await this.#get(FILES_STORE, fileId); return true; } catch { return false; }
  }

  async addFile(file, metadata = {}) {
    await this.init();
    let fileId = `${Date.now()}-${sanitizeFilename(file.name || 'audio')}`;
    let timestamp = Date.now();

    // store blob
    await this.#put(FILES_STORE, fileId, { blob: file, name: file.name, type: file.type });

    // update metadata list
    let files = await this.#get(META_STORE, 'files') || [];
    let meta = { id: fileId, name: file.name || 'Untitled', timestamp, size: file.size, type: file.type, ...metadata };
    files = files.filter(f => f.name !== meta.name);
    files.unshift(meta);
    files = files.slice(0, 10);
    await this.#put(META_STORE, 'files', files);

    return fileId;
  }

  async updateFile(fileId, file, metadata = {}) {
    await this.init();
    await this.#put(FILES_STORE, fileId, { blob: file, name: file.name, type: file.type });

    let files = await this.#get(META_STORE, 'files') || [];
    let idx = files.findIndex(f => f.id === fileId);
    if (idx !== -1) {
      files[idx] = { ...files[idx], size: file.size, type: file.type, ...metadata, modified: Date.now() };
      await this.#put(META_STORE, 'files', files);
    }
  }

  async deleteFile(fileId) {
    await this.init();
    let files = await this.#get(META_STORE, 'files') || [];
    await this.#put(META_STORE, 'files', files.filter(f => f.id !== fileId));
    await this.#del(FILES_STORE, fileId);
  }

  async clearAll() {
    await this.init();
    await this.#clear(FILES_STORE);
    await this.#put(META_STORE, 'files', []);
  }

  async getStoreInfo() {
    if (navigator.storage?.estimate) {
      let est = await navigator.storage.estimate();
      return { usage: est.usage, quota: est.quota, usagePercent: (est.usage / est.quota * 100).toFixed(2) };
    }
    return null;
  }

  // IDB helpers
  #tx(store, mode = 'readonly') { return this.db.transaction(store, mode).objectStore(store); }
  #get(store, key) { return new Promise((res, rej) => { let r = this.#tx(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  #put(store, key, val) { return new Promise((res, rej) => { let r = this.#tx(store, 'readwrite').put(val, key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
  #del(store, key) { return new Promise((res, rej) => { let r = this.#tx(store, 'readwrite').delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
  #clear(store) { return new Promise((res, rej) => { let r = this.#tx(store, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
}
