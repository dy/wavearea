// OPFS storage adapter

import { sortFiles, sanitizeFilename, updateFileList, fileMeta } from './adapter.js';

const METADATA_FILE = 'files-metadata.json', FILES_DIR = 'audio-files'

export class OPFSAdapter {
  constructor() { this.root = null; this.filesDir = null }

  async init() {
    if (this.root) return
    this.root = await navigator.storage.getDirectory()
    this.filesDir = await this.root.getDirectoryHandle(FILES_DIR, { create: true })
  }

  async getFiles(opts = {}) {
    await this.init()
    try {
      let f = await this.root.getFileHandle(METADATA_FILE)
      return sortFiles(JSON.parse(await (await f.getFile()).text()), opts)
    } catch { return [] }
  }

  async getFile(id) {
    await this.init()
    return (await this.filesDir.getFileHandle(id)).getFile()
  }

  async hasFile(id) {
    await this.init()
    let files = await this.getFiles()
    if (!files.some(f => f.id === id)) return false
    try { await this.filesDir.getFileHandle(id); return true } catch { return false }
  }

  async addFile(file, extra = {}) {
    await this.init()
    let id = `${Date.now()}-${sanitizeFilename(file.name || 'audio')}`

    let fh = await this.filesDir.getFileHandle(id, { create: true })
    let w = await fh.createWritable(); await w.write(file); await w.close()

    let files = updateFileList(await this.getFiles(), fileMeta(file, id, extra))
    await this.#cleanupOld(files)
    await this.#saveMeta(files)
    return id
  }

  async updateFile(id, file, extra = {}) {
    await this.init()
    let fh = await this.filesDir.getFileHandle(id)
    let w = await fh.createWritable(); await w.write(file); await w.close()

    let files = await this.getFiles()
    let i = files.findIndex(f => f.id === id)
    if (i !== -1) { files[i] = { ...files[i], size: file.size, type: file.type, ...extra, modified: Date.now() }; await this.#saveMeta(files) }
  }

  async deleteFile(id) {
    await this.init()
    let files = await this.getFiles()
    await this.#saveMeta(files.filter(f => f.id !== id))
    await this.filesDir.removeEntry(id)
  }

  async clearAll() {
    await this.init()
    for await (let e of this.filesDir.values()) await this.filesDir.removeEntry(e.name)
    await this.#saveMeta([])
  }

  async getStoreInfo() {
    if (!navigator.storage?.estimate) return null
    let e = await navigator.storage.estimate()
    return { usage: e.usage, quota: e.quota, usagePercent: (e.usage / e.quota * 100).toFixed(2) }
  }

  async #saveMeta(files) {
    let fh = await this.root.getFileHandle(METADATA_FILE, { create: true })
    let w = await fh.createWritable(); await w.write(JSON.stringify(files)); await w.close()
  }

  async #cleanupOld(current) {
    let ids = new Set(current.map(f => f.id))
    for await (let e of this.filesDir.values()) if (!ids.has(e.name)) await this.filesDir.removeEntry(e.name)
  }
}
