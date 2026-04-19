import { openDB } from 'idb';
import { Database } from 'sql.js';

const DB_NAME = 'geofield_au_db';
const STORE_NAME = 'sqlite_data';
const DB_VERSION = 1;

/**
 * Export full local database into a downloadable .sqlite file.
 */
export async function exportBackup(db: Database) {
  try {
    const data = db.export();
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `geofield-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export failed:', err);
    alert('Failed to export backup.');
  }
}

/**
 * Restore database from uploaded backup file.
 */
export async function importBackup(file: File) {
  try {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    // Validate it's a SQLite file (basic check)
    const header = String.fromCharCode(...data.slice(0, 15));
    if (!header.includes('SQLite format 3')) {
      alert('Invalid backup file. Please provide a valid .sqlite file.');
      return;
    }

    const idb = await openDB(DB_NAME, DB_VERSION);
    await idb.put(STORE_NAME, data, 'database');
    
    alert('Backup restored successfully. The application will now reload.');
    window.location.reload();
  } catch (err) {
    console.error('Import failed:', err);
    alert('Failed to import backup.');
  }
}
