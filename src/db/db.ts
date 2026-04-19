import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { openDB, IDBPDatabase } from 'idb';
import { DDL, SEED } from './schema';
import { runMigrations } from './migrations';

const DB_NAME = 'geofield_au_db';
const STORE_NAME = 'sqlite_data';
const DB_VERSION = 1;

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

const GEOFIELD_STORAGE_KEYS = [
  'geofield_active_project_id',
  'geo_author',
  'geofield_auto_backup',
  'geofield_pref_style',
  'geofield_pref_qualifiers',
  'custom_observations',
  'geofield_init_attempt_count',
] as const;

const locateSqlJsFile = (file: string): string => {
  if (file.endsWith('.wasm')) return sqlWasmUrl;
  return file;
};

const deleteIndexedDbDatabase = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete IndexedDB database: ${name}`));
    request.onblocked = () => reject(new Error(`IndexedDB delete blocked: ${name}`));
  });

/**
 * Initialize the SQLite database.
 * Loads from IndexedDB if available, otherwise creates new.
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[INIT] wasm start');
    try {
      const SQL = await initSqlJs({
        locateFile: locateSqlJsFile,
      });
      console.log('[INIT] wasm done');

      console.log('[INIT] sqlite open start');
      let idb: IDBPDatabase;
      try {
        idb = await openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            console.log('[DB] Upgrading IndexedDB schema...');
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          },
        });
        console.log('[INIT] sqlite open done');
      } catch (idbErr) {
        console.error('[DB] IndexedDB open failed, attempting to reset:', idbErr);
        await deleteIndexedDbDatabase(DB_NAME);
        idb = await openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            db.createObjectStore(STORE_NAME);
          },
        });
        console.log('[INIT] sqlite open done (fallback)');
      }

      console.log('[INIT] buffer load start');
      const savedDb: Uint8Array | undefined = await idb.get(STORE_NAME, 'database');
      console.log('[INIT] buffer load done', !!savedDb);

      if (savedDb) {
        try {
          dbInstance = new SQL.Database(savedDb);
        } catch (loadErr) {
          console.error('[DB] Failed to load saved database, creating fresh:', loadErr);
          dbInstance = new SQL.Database();
          dbInstance.run(DDL);
          dbInstance.run(SEED);
        }
      } else {
        console.log('[DB] Creating fresh database...');
        dbInstance = new SQL.Database();
        dbInstance.run(DDL);
        dbInstance.run(SEED);
        await persistDatabase();
      }

      console.log('[INIT] ref validation start');
      const tablesToCheck = ['ref_risk_level', 'ref_rock_strength', 'ref_joint_spacing'];
      let needsSeed = false;
      for (const table of tablesToCheck) {
        try {
          const count = dbInstance.exec(`SELECT COUNT(*) FROM ${table};`)[0]?.values[0][0] as number;
          if (count === 0) {
            needsSeed = true;
            console.warn(`[DB] Sanity Check: Table ${table} is empty.`);
            break;
          }
        } catch (e) {
          console.error(`[DB] Sanity Check failed for ${table}:`, e);
          needsSeed = true;
          break;
        }
      }

      if (needsSeed) {
        console.log('[DB] Running sanity seed...');
        try {
          dbInstance.run(SEED);
          await persistDatabase();
        } catch (seedErr) {
          console.error('[DB] Sanity seed failed:', seedErr);
        }
      }
      console.log('[INIT] ref validation done');

      console.log('[INIT] migrations start');
      try {
        const versionResult = dbInstance.exec('PRAGMA user_version;');
        const currentVersion = versionResult[0]?.values[0][0] as number;
        console.log(`[DB] Current DB version: ${currentVersion}`);
        await runMigrations(dbInstance, currentVersion, persistDatabase, SEED);
        console.log('[INIT] migrations done');
      } catch (versionErr) {
        console.error('[DB] Versioning/Migration check failed:', versionErr);
      }

      await ensureDefaultProject();

      console.log('[INIT] app ready');
      return dbInstance;
    } catch (fatalErr) {
      console.error('[DB] FATAL DATABASE INITIALIZATION ERROR:', fatalErr);
      try {
        const SQL = await initSqlJs({
          locateFile: locateSqlJsFile,
        });
        dbInstance = new SQL.Database();
        dbInstance.run(DDL);
        dbInstance.run(SEED);
        return dbInstance;
      } catch (fallbackErr) {
        console.error('[DB] Even fallback DB failed:', fallbackErr);
        throw new Error(`Database initialization failed: ${fatalErr instanceof Error ? fatalErr.message : String(fatalErr)}`);
      }
    }
  })();

  return initPromise;
}

/**
 * Ensure the default project "K-001" and its location exist.
 */
export async function ensureDefaultProject() {
  const existingProjects = query<any>('SELECT * FROM projects');

  if (existingProjects.length === 0) {
    console.log('[DB] Creating default project K-001...');
    const projectId = 'k-001-id';
    await execute(
      'INSERT INTO projects (id, name, code, is_active, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [projectId, 'K-001', 'K-001', 1]
    );

    const locId = 'k-001-loc-id';
    await execute(
      'INSERT INTO locations (id, cluster_key, description, chainage_start, chainage_end, side, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [locId, '0-1000-CL-Mid', 'K-001', 0, 1000, 'CL', 'Mid']
    );
  } else {
    const activeProjects = query<any>('SELECT * FROM projects WHERE is_active = 1');
    if (activeProjects.length === 0 && existingProjects.length > 0) {
      await execute('UPDATE projects SET is_active = 1 WHERE id = ?', [existingProjects[0].id]);
    }
  }
}

/**
 * Reset the local database and media store.
 */
export async function resetDatabase() {
  GEOFIELD_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name === DB_NAME) {
      await deleteIndexedDbDatabase(db.name);
    }
  }

  window.location.href = '/';
}

/**
 * Persist the current database state to IndexedDB.
 */
export async function persistDatabase() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const idb = await openDB(DB_NAME, DB_VERSION);
  await idb.put(STORE_NAME, data, 'database');
}

/**
 * Get the active database instance.
 */
export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function ensureQuickLogEntriesTable() {
  const db = getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS quick_log_entries (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      observation_mode TEXT,
      selected_observations TEXT,
      trigger_category TEXT,
      immediate_action TEXT,
      review_required INTEGER DEFAULT 0,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    );
  `);
}

function sanitizeParams(params: any[]): any[] {
  return params.map(p => p === undefined ? null : p);
}

export function query<T>(sql: string, params: any[] = []): T[] {
  const db = getDb();
  const safeParams = sanitizeParams(params);
  const stmt = db.prepare(sql);
  stmt.bind(safeParams);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export async function execute(sql: string, params: any[] = []) {
  const db = getDb();
  const safeParams = sanitizeParams(params);
  db.run(sql, safeParams);
  await persistDatabase();
}
