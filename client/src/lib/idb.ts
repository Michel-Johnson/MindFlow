type IdbValue = Blob;

const DB_NAME = "mindflow";
const DB_VERSION = 1;
const STORE_NAME = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));

        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          reject(tx.error ?? new Error("IndexedDB transaction failed"));
          db.close();
        };
      }),
  );
}

export async function idbGetBlob(key: string): Promise<Blob | null> {
  try {
    const value = (await withStore<IdbValue | undefined>("readonly", (s) =>
      s.get(key),
    )) as IdbValue | undefined;
    return value ?? null;
  } catch {
    return null;
  }
}

export async function idbSetBlob(key: string, blob: Blob): Promise<void> {
  await withStore("readwrite", (s) => s.put(blob, key));
}

export async function idbDel(key: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(key));
}

