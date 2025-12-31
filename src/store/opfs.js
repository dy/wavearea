// OPFS storage adapter for audio files
// Implements StoreAdapter interface using Origin Private File System

import { StoreAdapter, sortFiles, sanitizeFilename } from './adapter.js';

const FILES_LIMIT = 10;
const METADATA_FILE = 'files-metadata.json';
const FILES_DIR = 'audio-files';

export class OPFSAdapter extends StoreAdapter {
  constructor() {
    super();
    this.root = null;
    this.filesDir = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      // Get OPFS root directory
      this.root = await navigator.storage.getDirectory();

      // Create or get files directory
      this.filesDir = await this.root.getDirectoryHandle(FILES_DIR, { create: true });

      this.initialized = true;
      console.log('OPFS storage initialized');
    } catch (error) {
      console.error('Failed to initialize OPFS:', error);
      throw error;
    }
  }

  async getFiles(options = {}) {
    await this.init();

    try {
      const metadataHandle = await this.root.getFileHandle(METADATA_FILE);
      const file = await metadataHandle.getFile();
      const text = await file.text();
      const files = JSON.parse(text);

      // Use shared sorting helper
      return sortFiles(files, options);
    } catch (error) {
      // File doesn't exist yet
      if (error.name === 'NotFoundError') {
        return [];
      }
      console.error('Failed to get files:', error);
      return [];
    }
  }

  async hasFile(fileId) {
    await this.init();

    try {
      // Check if file exists in metadata
      const files = await this.getFiles();
      const hasMetadata = files.some(f => f.id === fileId);

      // Check if file exists in OPFS
      if (hasMetadata) {
        try {
          await this.filesDir.getFileHandle(fileId);
          return true;
        } catch {
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to check file existence:', error);
      return false;
    }
  }

  async getFile(fileId) {
    await this.init();

    try {
      const fileHandle = await this.filesDir.getFileHandle(fileId);
      const file = await fileHandle.getFile();
      return file;
    } catch (error) {
      console.error('Failed to get file:', error);
      throw error;
    }
  }

  async addFile(file, metadata = {}) {
    await this.init();

    const fileId = `${Date.now()}-${sanitizeFilename(file.name || 'audio')}`;
    const timestamp = Date.now();

    try {
      // Save the audio file
      const fileHandle = await this.filesDir.getFileHandle(fileId, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      // Update files list
      const files = await this.getFiles();

      // Add new file metadata
      const fileMetadata = {
        id: fileId,
        name: file.name || 'Untitled',
        timestamp,
        size: file.size,
        type: file.type,
        ...metadata
      };

      // Remove duplicate if exists (same name)
      const filteredFiles = files.filter(f => f.name !== fileMetadata.name);

      // Add to beginning and limit
      filteredFiles.unshift(fileMetadata);
      const limitedFiles = filteredFiles.slice(0, FILES_LIMIT);

      // Clean up old files that are no longer in list
      await this.#cleanupOldFiles(limitedFiles);

      // Save updated metadata
      await this.#saveMetadata(limitedFiles);

      console.log('Added file:', fileMetadata);
      return fileId;
    } catch (error) {
      console.error('Failed to add file:', error);
      throw error;
    }
  }

  async updateFile(fileId, file, metadata = {}) {
    await this.init();

    try {
      // Update the file content
      const fileHandle = await this.filesDir.getFileHandle(fileId);
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      // Update metadata
      const files = await this.getFiles();
      const fileIndex = files.findIndex(f => f.id === fileId);

      if (fileIndex !== -1) {
        files[fileIndex] = {
          ...files[fileIndex],
          size: file.size,
          type: file.type,
          ...metadata,
          // Keep original timestamp, update modified time
          modified: Date.now()
        };
        await this.#saveMetadata(files);
      }

      console.log('Updated file:', fileId);
    } catch (error) {
      console.error('Failed to update file:', error);
      throw error;
    }
  }

  async deleteFile(fileId) {
    await this.init();

    try {
      // Remove from files list
      const files = await this.getFiles();
      const filteredFiles = files.filter(f => f.id !== fileId);
      await this.#saveMetadata(filteredFiles);

      // Delete the actual file
      await this.filesDir.removeEntry(fileId);

      console.log('Deleted file:', fileId);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async clearAll() {
    await this.init();

    try {
      // Delete all audio files
      for await (const entry of this.filesDir.values()) {
        await this.filesDir.removeEntry(entry.name);
      }

      // Clear metadata
      await this.#saveMetadata([]);

      console.log('Cleared all files');
    } catch (error) {
      console.error('Failed to clear all files:', error);
      throw error;
    }
  }

  async getStoreInfo() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        usagePercent: (estimate.usage / estimate.quota * 100).toFixed(2)
      };
    }
    return null;
  }

  // Private methods

  async #saveMetadata(files) {
    try {
      const metadataHandle = await this.root.getFileHandle(METADATA_FILE, { create: true });
      const writable = await metadataHandle.createWritable();
      await writable.write(JSON.stringify(files, null, 2));
      await writable.close();
    } catch (error) {
      console.error('Failed to save metadata:', error);
      throw error;
    }
  }

  async #cleanupOldFiles(currentFiles) {
    try {
      const currentIds = new Set(currentFiles.map(f => f.id));

      // Iterate through all files in storage
      for await (const entry of this.filesDir.values()) {
        if (!currentIds.has(entry.name)) {
          await this.filesDir.removeEntry(entry.name);
          console.log('Cleaned up old file:', entry.name);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
    }
  }
}
