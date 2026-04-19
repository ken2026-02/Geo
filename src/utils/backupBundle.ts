import JSZip from 'jszip';
import { getDb, persistDatabase, query } from '../db/db';
import { getBlob, putBlob } from '../media/mediaStore';
import { openDB } from 'idb';

const APP_VERSION = '1.0.0';

/**
 * Export full backup (SQLite + media blobs) as a single ZIP.
 */
export async function exportBackupZip() {
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
    version: APP_VERSION,
    exported_at: new Date().toISOString(),
    // activeProjectId could be fetched if needed, but we'll keep it simple
  };
  zip.file('meta/manifest.json', JSON.stringify(manifest, null, 2));

  // Generate and download
  const content = await zip.generateAsync({ type: 'blob' });
  const fileName = `geofield-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)}.zip`;
  
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import backup ZIP to fully restore app data.
 */
export async function importBackupZip(file: File) {
  const confirmed = window.confirm('Importing this backup will OVERWRITE all current local data. Are you sure?');
  if (!confirmed) return;

  try {
    const zip = await JSZip.loadAsync(file);
    
    // Validate ZIP structure
    const dbFile = zip.file('db/geofield.sqlite');
    const indexFile = zip.file('media/index.json');
    const manifestFile = zip.file('meta/manifest.json');

    if (!dbFile || !indexFile || !manifestFile) {
      throw new Error('Invalid backup file: missing required components (db, media index, or manifest).');
    }

    // 1. Restore SQLite
    const dbBuffer = await dbFile.async('uint8array');
    const idb = await openDB('geofield_au_db', 1);
    await idb.put('sqlite_data', dbBuffer, 'database');

    // 2. Restore Media Blobs
    const indexContent = await indexFile.async('string');
    const mediaMetadata = JSON.parse(indexContent);
    
    for (const item of mediaMetadata) {
      const blobFile = zip.file(`media/blobs/${item.blob_key}`);
      if (blobFile) {
        const blob = await blobFile.async('blob');
        // We use putBlob but we need it to use the specific key from the backup
        // Let's check if putBlob supports key. It doesn't.
        // I'll use idb directly here to ensure keys are preserved.
        const mediaIdb = await openDB('geofield_au_media', 1);
        await mediaIdb.put('blobs', blob, item.blob_key);
      }
    }

    alert('Backup restored successfully. The app will now reload.');
    window.location.reload();
  } catch (error: any) {
    console.error('Import failed:', error);
    alert(`Import failed: ${error.message}`);
  }
}
