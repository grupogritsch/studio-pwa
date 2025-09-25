
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'logistik-db';
const DB_VERSION = 3;
const OCCURRENCES_STORE = 'occurrences';
const OFFLINE_STORE = 'offline_occurrences';
const ROTEIROS_STORE = 'roteiros';

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
      synced?: boolean;
      roteiroId?: number;
    };
    indexes: { 'timestamp': string; 'roteiroId': number };
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
  [ROTEIROS_STORE]: {
    key: number;
    value: {
      id: number;
      startDate: string;
      endDate: string;
      totalOccurrences: number;
      syncedOccurrences: number;
      vehiclePlate?: string;
      startKm?: number;
    };
    indexes: { 'endDate': string };
  };
}

let dbPromise: Promise<IDBPDatabase<LogistikDB>> | null = null;

const initDB = async () => {
  if (typeof window === 'undefined') {
    return Promise.reject('IndexedDB is not available.');
  }

  if (!dbPromise) {
    dbPromise = openDB<LogistikDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(OCCURRENCES_STORE)) {
          const store = db.createObjectStore(OCCURRENCES_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('roteiroId', 'roteiroId');
        } else if (oldVersion < 3) {
          // Adicionar índice roteiroId para versões antigas
          const store = db.transaction.objectStore(OCCURRENCES_STORE);
          if (!store.indexNames.contains('roteiroId')) {
            store.createIndex('roteiroId', 'roteiroId');
          }
        }
        if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
          const store = db.createObjectStore(OFFLINE_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains(ROTEIROS_STORE)) {
          const store = db.createObjectStore(ROTEIROS_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('endDate', 'endDate');
        }
      },
      blocked() {
        console.warn('IndexedDB upgrade blocked');
      },
      blocking() {
        console.warn('IndexedDB blocking');
      },
      terminated() {
        console.warn('IndexedDB terminated, resetting connection');
        dbPromise = null;
      },
    });
  }

  try {
    const db = await dbPromise;
    // Test if connection is still valid
    await db.getAll(ROTEIROS_STORE);
    return db;
  } catch (error) {
    console.warn('Database connection invalid, creating new one');
    dbPromise = null;
    return initDB();
  }
};

export const db = {
  async addOccurrence(occurrence: Omit<LogistikDB['occurrences']['value'], 'id'>) {
    const db = await initDB();
    // Se não tem roteiroId, pega o roteiro ativo do localStorage
    if (!occurrence.roteiroId && typeof window !== 'undefined') {
      const activeRoteiroData = localStorage.getItem('currentRoteiroData');
      if (activeRoteiroData) {
        const data = JSON.parse(activeRoteiroData);
        if (data.apiRoteiroId) {
          occurrence.roteiroId = data.apiRoteiroId;
        }
      }
    }
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
  },
  async updateOccurrenceSync(id: number, synced: boolean) {
    const db = await initDB();
    const occurrence = await db.get(OCCURRENCES_STORE, id);
    if (occurrence) {
      occurrence.synced = synced;
      await db.put(OCCURRENCES_STORE, occurrence);
    }
  },
  async updateOccurrenceWithRoteiro(id: number, roteiroId: number, synced?: boolean) {
    const db = await initDB();
    const occurrence = await db.get(OCCURRENCES_STORE, id);
    if (occurrence) {
      occurrence.roteiroId = roteiroId;
      if (synced !== undefined) {
        occurrence.synced = synced;
      }
      await db.put(OCCURRENCES_STORE, occurrence);
    }
  },
  async getUnsyncedOccurrences() {
    const db = await initDB();
    const allOccurrences = await db.getAll(OCCURRENCES_STORE);
    return allOccurrences.filter(occ => !occ.synced);
  },
  async addRoteiro(roteiro: Omit<LogistikDB['roteiros']['value'], 'id'>) {
    const db = await initDB();
    return db.add(ROTEIROS_STORE, roteiro as any);
  },
  async getAllRoteiros() {
    let retries = 3;
    while (retries > 0) {
      try {
        const db = await initDB();
        console.log('Buscando roteiros no IndexedDB...');
        const roteiros = await db.getAll(ROTEIROS_STORE);
        console.log('Roteiros encontrados no DB:', roteiros);
        return roteiros;
      } catch (error) {
        console.error(`Error getting roteiros (${4 - retries} attempt):`, error);
        retries--;

        if (error.message?.includes('database connection is closing') ||
            error.message?.includes('transaction') ||
            retries === 0) {
          dbPromise = null;
          if (retries > 0) {
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }
        }

        if (retries === 0) {
          return [];
        }
      }
    }
    return [];
  },
  async getOccurrencesByRoteiro(roteiroId: number) {
    const db = await initDB();
    try {
      return await db.getAllFromIndex(OCCURRENCES_STORE, 'roteiroId', roteiroId);
    } catch (error) {
      console.error('Error getting occurrences by roteiro:', error);
      return [];
    }
  },
  async getActiveOccurrences() {
    let retries = 3;
    while (retries > 0) {
      try {
        const db = await initDB();

        // Pegar o roteiroId ativo do localStorage
        if (typeof window !== 'undefined') {
          const activeRoteiroData = localStorage.getItem('currentRoteiroData');
          if (activeRoteiroData) {
            const data = JSON.parse(activeRoteiroData);
            if (data.apiRoteiroId) {
              // Buscar ocorrências do roteiro ativo - sempre retornar array (pode ser vazio)
              const occurrences = await db.getAllFromIndex(OCCURRENCES_STORE, 'roteiroId', data.apiRoteiroId);
              console.log(`Ocorrências do roteiro ${data.apiRoteiroId}:`, occurrences);
              return occurrences || [];
            }
          }
        }

        // Se não há roteiro ativo no localStorage, retornar array vazio
        // Não buscar ocorrências órfãs para evitar misturar roteiros
        return [];
      } catch (error) {
        console.error(`Error getting active occurrences (${4 - retries} attempt):`, error);
        retries--;

        if (error.message?.includes('database connection is closing') ||
            error.message?.includes('transaction') ||
            retries === 0) {
          dbPromise = null;
          if (retries > 0) {
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }
        }

        if (retries === 0) {
          return [];
        }
      }
    }
    return [];
  }
};

export async function dataURLtoBlob(dataurl: string): Promise<Blob> {
    const res = await fetch(dataurl);
    return await res.blob();
}
