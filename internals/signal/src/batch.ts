/**
 * Batch multiple signal updates using microtask scheduling
 *
 * Updates are collected and executed in a single microtask to prevent
 * multiple synchronous DOM updates and layout thrashing.
 */

// Queue of pending updates
let updateQueue = new Set<() => void>();
let isFlushScheduled = false;
let isBatching = false;

/**
 * Schedule a notification to run in a microtask
 */
export function scheduleUpdate(notify: () => void): void {
  // If we're in a batch, always queue the update
  if (isBatching) {
    updateQueue.add(notify);
    return;
  }

  // If not batching, check if we should schedule a flush
  updateQueue.add(notify);

  if (!isFlushScheduled) {
    isFlushScheduled = true;
    queueMicrotask(flushUpdates);
  }
}

/**
 * Flush all pending updates
 */
function flushUpdates(): void {
  isFlushScheduled = false;

  // Copy and clear the queue to handle updates that trigger new updates
  const updates = Array.from(updateQueue);
  updateQueue.clear();

  // Execute all updates
  for (const notify of updates) {
    notify();
  }
}

/**
 * Batch multiple signal updates
 * All updates inside the batch function will be deferred until the batch completes
 */
export function batch<T>(fn: () => T): T {
  // If already batching, just run the function
  if (isBatching) {
    return fn();
  }

  isBatching = true;

  try {
    const result = fn();
    return result;
  } finally {
    isBatching = false;

    // Flush all queued updates immediately after the batch
    if (updateQueue.size > 0) {
      const updates = Array.from(updateQueue);
      updateQueue.clear();

      for (const notify of updates) {
        notify();
      }
    }
  }
}
