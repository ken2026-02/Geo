import { openDB, IDBPDatabase } from 'idb';

const MEDIA_DB_NAME = 'geofield_au_media';
const MEDIA_STORE_NAME = 'blobs';
const DB_VERSION = 2; // Bumped version

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (!dbPromise) {
    console.log('[MEDIA] db open start');
    dbPromise = openDB(MEDIA_DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[MEDIA] upgrade from ${oldVersion} to ${newVersion}`);
        if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
          db.createObjectStore(MEDIA_STORE_NAME);
        }
      },
    }).catch((err) => {
      // Important for field reliability: if IndexedDB open fails once (quota, private mode,
      // transient browser issue), allow the next attempt to retry rather than keeping a
      // permanently rejected promise in memory.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

const createBlobKey = (): string => {
  try {
    // Some older mobile runtimes lack crypto.randomUUID(). Fall back safely.
    const fn = (globalThis as any)?.crypto?.randomUUID;
    if (typeof fn === 'function') return String(fn.call((globalThis as any).crypto));
  } catch {
    // ignore
  }
  return `blob_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
};

const toFriendlyMediaError = (err: unknown, context: string) => {
  const e = err as any;
  const name = String(e?.name || '');
  const msg = String(e?.message || '');
  const isQuota =
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota|storage|exceeded/i.test(msg);
  if (isQuota) {
    return new Error(
      `${context}: device storage quota exceeded. Try a smaller photo, enable persistent storage, or clear old photos/backups.`
    );
  }
  return new Error(`${context}: ${msg || 'Unexpected media storage error'}`);
};

/**
 * Check if media store exists and is healthy.
 */
export async function checkMediaStoreHealthy(): Promise<boolean> {
  try {
    const db = await getDB();
    const exists = db.objectStoreNames.contains(MEDIA_STORE_NAME);
    console.log(`[MEDIA] store exists: ${exists}`);
    return exists;
  } catch (err) {
    console.error('[MEDIA] store health check failed', err);
    return false;
  }
}

/**
 * Store a blob and return a unique key.
 */
export async function putBlob(blob: Blob): Promise<string> {
  const db = await getDB();
  if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
    throw new Error(`[MEDIA] Object store ${MEDIA_STORE_NAME} not found`);
  }
  const key = createBlobKey();
  try {
    await db.put(MEDIA_STORE_NAME, blob, key);
  } catch (err) {
    throw toFriendlyMediaError(err, 'Failed to save photo locally');
  }
  console.log('[MEDIA] put blob success', key);
  return key;
}

/**
 * Retrieve a blob by key.
 */
export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await getDB();
  if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
    throw new Error(`[MEDIA] Object store ${MEDIA_STORE_NAME} not found`);
  }
  const blob = await db.get(MEDIA_STORE_NAME, key);
  if (blob) {
    console.log('[MEDIA] get blob success', key);
  }
  return blob;
}

/**
 * Delete a blob by key.
 */
export async function deleteBlob(key: string): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
    throw new Error(`[MEDIA] Object store ${MEDIA_STORE_NAME} not found`);
  }
  await db.delete(MEDIA_STORE_NAME, key);
  console.log('[MEDIA] delete blob success', key);
}
