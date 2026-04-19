import JSZip from 'jszip';
import { getDb, query } from '../db/db';
import { getBlob } from '../media/mediaStore';
import { openDB, IDBPDatabase } from 'idb';

const BACKUP_DB_NAME = 'geofield_au_backups_db';
const BACKUP_STORE_NAME = 'backups';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getBackupDB() {
  if (!dbPromise) {
    dbPromise = openDB(BACKUP_DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
          db.createObjectStore(BACKUP_STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Check if auto-backup should be performed.
 * Rule: if last backup > 6 hours OR none exists today.
 */
export async function shouldAutoBackup(): Promise<boolean> {
  const db = await getBackupDB();
  const allBackups = await db.getAll(BACKUP_STORE_NAME);
  if (allBackups.length === 0) return true;

  // Sort by created_at desc
  const sorted = allBackups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const lastBackup = sorted[0];
  const lastTime = new Date(lastBackup.created_at).getTime();
  const now = Date.now();

  const sixHours = 6 * 60 * 60 * 1000;
  if (now - lastTime > sixHours) return true;

  const lastDate = new Date(lastBackup.created_at).toDateString();
  const today = new Date().toDateString();
  if (lastDate !== today) return true;

  return false;
}

/**
 * Create backup zip and store in IndexedDB.
 */
export async function saveAutoBackupZip(maxKeep = 10) {
  const zip = new JSZip();
  const db = getDb();
  
  // 1. SQLite DB
  const dbBuffer = db.export();
  zip.file('db/geofield.sqlite', dbBuffer);

  // 2. Media Metadata
  const mediaMetadata = query<any>('SELECT * FROM media_metadata');
  zip.file('media/index.json', JSON.stringify(mediaMetadata, null, 2));

  // 3. Media Blobs
  const mediaFolder = zip.folder('media/blobs');
  if (mediaFolder) {
    for (const item of mediaMetadata) {
      const blob = await getBlob(item.blob_key);
      if (blob) {
        mediaFolder.file(item.blob_key, blob);
      }
    }
  }

  // 4. Manifest
  const manifest = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
  };
  zip.file('meta/manifest.json', JSON.stringify(manifest, null, 2));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  const backupRecord = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    size_bytes: zipBlob.size,
    zip_blob: zipBlob,
  };

  const backupDb = await getBackupDB();
  await backupDb.put(BACKUP_STORE_NAME, backupRecord);

  // Manage rolling backups
  const allBackups = await backupDb.getAll(BACKUP_STORE_NAME);
  if (allBackups.length > maxKeep) {
    const sorted = allBackups.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const toDelete = sorted.slice(0, allBackups.length - maxKeep);
    for (const item of toDelete) {
      await backupDb.delete(BACKUP_STORE_NAME, item.id);
    }
  }
}

/**
 * List all available auto-backups.
 */
export async function listAutoBackups() {
  const db = await getBackupDB();
  const all = await db.getAll(BACKUP_STORE_NAME);
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Delete a specific auto-backup.
 */
export async function deleteAutoBackup(id: string) {
  const db = await getBackupDB();
  await db.delete(BACKUP_STORE_NAME, id);
}
