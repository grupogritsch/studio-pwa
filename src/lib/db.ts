
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'logistik-db';
const DB_VERSION = 1;
const OCCURRENCES_STORE = 'occurrences';
const OFFLINE_STORE = 'offline_occurrences';

interface LogistikDB extends DBSchema {
  [OCCURRENCES_STORE]: {
    key: number;
    value: {
      id: number;
      scannedCode: string;
      occurrence: string;
      timestamp: string;
      receiverName?: string;
      receiverDocument?: string;
    };
    indexes: { 'timestamp': string };
  };
  [OFFLINE_STORE]: {
    key: number;
    value: {
      id: number;
      scannedCode: string;
      occurrence: string;
      timestamp: string;
      receiverName?: string;
      receiverDocument?: string;
      photo?: Blob;
    };
    indexes: { 'timestamp': string };
  };
}

let dbPromise: Promise<IDBPDatabase<LogistikDB>>;

const initDB = () => {
  if (typeof window !== 'undefined') {
    if (!dbPromise) {
      dbPromise = openDB<LogistikDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(OCCURRENCES_STORE)) {
            const store = db.createObjectStore(OCCURRENCES_STORE, {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
            const store = db.createObjectStore(OFFLINE_STORE, {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('timestamp', 'timestamp');
          }
        },
      });
    }
    return dbPromise;
  }
   return Promise.reject('IndexedDB is not available.');
};

export const db = {
  async addOccurrence(occurrence: Omit<LogistikDB['occurrences']['value'], 'id'>) {
    const db = await initDB();
    return db.add(OCCURRENCES_STORE, occurrence as any);
  },
  async addOfflineOccurrence(occurrence: Omit<LogistikDB['offline_occurrences']['value'], 'id'>) {
    const db = await initDB();
    return db.add(OFFLINE_STORE, occurrence as any);
  },
  async getAllOccurrences() {
    const db = await initDB();
    return db.getAllFromIndex(OCCURRENCES_STORE, 'timestamp');
  },
  async getOfflineOccurrences() {
    const db = await initDB();
    return db.getAll(OFFLINE_STORE);
  },
  async countOfflineOccurrences() {
    const db = await initDB();
    return db.count(OFFLINE_STORE);
  },
  async clearAllData() {
    const db = await initDB();
    await db.clear(OCCURRENCES_STORE);
    await db.clear(OFFLINE_STORE);
  },
  async clearOfflineData() {
    const db = await initDB();
    await db.clear(OFFLINE_STORE);
  }
};

export async function dataURLtoBlob(dataurl: string): Promise<Blob> {
    const res = await fetch(dataurl);
    return await res.blob();
}
