/**
 * Per-project mutex to prevent concurrent sandbox operations.
 * Ensures only one create/suspend/resume runs at a time per project.
 *
 * Uses promise-chaining pattern: the new promise is stored in the map
 * BEFORE awaiting the previous one, closing the race window.
 */

const locks = new Map<string, Promise<void>>();

/**
 * Acquire a mutex for a project.
 * If another operation is in progress, queues behind it.
 * Uses chaining (not polling) to prevent the gap between check-and-set.
 */
export async function withProjectMutex<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(projectId) ?? Promise.resolve();

  let releaseFn: () => void;
  const current = new Promise<void>((resolve) => {
    releaseFn = resolve;
  });

  // Set our promise BEFORE awaiting — no gap for another caller to slip through
  locks.set(projectId, current);

  await prev;

  try {
    return await fn();
  } finally {
    // Only delete if we're still the latest in the chain
    if (locks.get(projectId) === current) {
      locks.delete(projectId);
    }
    releaseFn!();
  }
}
