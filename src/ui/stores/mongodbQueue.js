/**
 * MongoDB Queue Store
 * Manages pending records that need to be synced to MongoDB
 * Uses localStorage for persistence
 */

const QUEUE_KEY = 'mongodb-sync-queue-v1';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

/**
 * Get all pending records from the queue
 * @returns {Array} Array of queued records
 */
export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Add a record to the sync queue
 * @param {Object} record - Record to queue
 * @returns {Object} The queued record with metadata
 */
export function enqueueRecord(record) {
  const queue = getQueue();
  const queuedRecord = {
    ...record,
    _queued: true,
    _queuedAt: Date.now(),
    _retries: 0,
    _lastError: null
  };
  
  queue.push(queuedRecord);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  
  return queuedRecord;
}

/**
 * Remove a record from the queue by index
 * @param {number} index - Index in queue
 */
export function removeFromQueue(index) {
  const queue = getQueue();
  if (index >= 0 && index < queue.length) {
    queue.splice(index, 1);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

/**
 * Mark a record as failed (increment retries and store error)
 * @param {number} index - Index in queue
 * @param {string} errorMessage - Error message
 */
export function markRetry(index, errorMessage) {
  const queue = getQueue();
  if (index >= 0 && index < queue.length) {
    queue[index]._retries = (queue[index]._retries || 0) + 1;
    queue[index]._lastError = errorMessage;
    queue[index]._lastRetryAt = Date.now();
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

/**
 * Get records that are ready to retry (haven't exceeded max retries)
 * @returns {Array} Records ready to retry
 */
export function getRetryableRecords() {
  const queue = getQueue();
  return queue.filter(record => (record._retries || 0) < MAX_RETRIES);
}

/**
 * Get records that have exceeded max retries
 * @returns {Array} Failed records
 */
export function getFailedRecords() {
  const queue = getQueue();
  return queue.filter(record => (record._retries || 0) >= MAX_RETRIES);
}

/**
 * Clear all queued records
 */
export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Get queue statistics
 * @returns {Object} Statistics about the queue
 */
export function getQueueStats() {
  const queue = getQueue();
  const retryable = getRetryableRecords().length;
  const failed = getFailedRecords().length;
  
  return {
    total: queue.length,
    retryable,
    failed,
    isEmpty: queue.length === 0
  };
}

/**
 * Migrate a record from queue after successful sync
 * This removes it from queue but keeps a record it was synced
 * @param {number} index - Index in queue
 * @param {string} mongodbId - The MongoDB inserted ID
 */
export function markSynced(index, mongodbId) {
  const queue = getQueue();
  if (index >= 0 && index < queue.length) {
    const record = queue[index];
    // Store in synced records for history
    const syncedKey = 'mongodb-synced-records-v1';
    const syncedRecords = JSON.parse(localStorage.getItem(syncedKey) || '[]');
    syncedRecords.push({
      mongodbId,
      clipName: record.clipName,
      syncedAt: Date.now(),
      localTimestamp: record.timestamp
    });
    
    // Keep only last 500 synced records
    if (syncedRecords.length > 500) {
      syncedRecords.splice(0, syncedRecords.length - 500);
    }
    
    localStorage.setItem(syncedKey, JSON.stringify(syncedRecords));
    
    // Remove from queue
    removeFromQueue(index);
  }
}

/**
 * Get sync history (recently synced records)
 * @returns {Array} Recently synced records
 */
export function getSyncHistory() {
  try {
    const raw = localStorage.getItem('mongodb-synced-records-v1');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
