import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'smartboard';
const STORE = 'documents';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    const database = await db()?.catch(() => null);
    await database?.put(STORE, value, key);
  } catch {
    /* IndexedDB can be unavailable (private mode); callers keep localStorage. */
  }
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const database = await db()?.catch(() => null);
    return (await database?.get(STORE, key)) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const database = await db()?.catch(() => null);
    await database?.delete(STORE, key);
  } catch {
    /* ignore */
  }
}
