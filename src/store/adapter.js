// Store interface - defines the contract for all storage implementations
// Implementations can be: OPFS, IndexedDB, LocalStore, Remote API, etc.

/**
 * Base storage interface that all adapters must implement
 * @interface
 */
export class StoreAdapter {
  /**
   * Initialize storage
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('init() must be implemented');
  }

  /**
   * Get list of files with optional sorting
   * @param {Object} options - {sortBy: 'name'|'date'|'size'|'type', order: 'asc'|'desc'}
   * @returns {Promise<Array>} Array of file metadata objects
   */
  async getFiles(options = {}) {
    throw new Error('getFiles() must be implemented');
  }

  /**
   * Get a file by ID (Read operation)
   * @param {string} fileId - File identifier
   * @returns {Promise<File|Blob>}
   */
  async getFile(fileId) {
    throw new Error('getFile() must be implemented');
  }

  /**
   * Add a file to storage
   * @param {string} fileId - The file id to check
   * @returns {Promise<string>} File ID
   */
  async hasFile(fileId) {
    throw new Error('hasFile() must be implemented');
  }

  /**
   * Add a file to storage
   * @param {File|Blob} file - The file to store
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<string>} File ID
   */
  async addFile(file, metadata = {}) {
    throw new Error('addFile() must be implemented');
  }

  /**
   * Update an existing file (Update operation)
   * @param {string} fileId - File identifier
   * @param {File|Blob} file - The new file content
   * @param {Object} metadata - Updated metadata
   * @returns {Promise<void>}
   */
  async updateFile(fileId, file, metadata = {}) {
    throw new Error('updateFile() must be implemented');
  }

  /**
   * Delete a file by ID (Delete operation)
   * @param {string} fileId - File identifier
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    throw new Error('deleteFile() must be implemented');
  }

  /**
   * Clear all files
   * @returns {Promise<void>}
   */
  async clearAll() {
    throw new Error('clearAll() must be implemented');
  }

  /**
   * Get storage usage info
   * @returns {Promise<Object>} {usage, quota, usagePercent}
   */
  async getStoreInfo() {
    throw new Error('getStoreInfo() must be implemented');
  }
}

/**
 * Helper to sort file metadata arrays
 * @param {Array} files - Array of file metadata
 * @param {Object} options - Sort options
 * @returns {Array} Sorted array
 */
export function sortFiles(files, { sortBy = 'date', order = 'desc' } = {}) {
  return [...files].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'type':
        comparison = (a.type || '').localeCompare(b.type || '');
        break;
      case 'date':
      default:
        comparison = a.timestamp - b.timestamp;
    }
    return order === 'desc' ? -comparison : comparison;
  });
}

/**
 * Helper to sanitize filenames
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}
