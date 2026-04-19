/**
 * Check if storage is already persisted.
 */
export async function checkPersisted(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persisted) return false;
  return await navigator.storage.persisted();
}

/**
 * Request storage persistence.
 */
export async function requestPersist(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) return false;
  return await navigator.storage.persist();
}

/**
 * Estimate storage usage and quota.
 */
export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage || !navigator.storage.estimate) return { usage: 0, quota: 0 };
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
  };
}
