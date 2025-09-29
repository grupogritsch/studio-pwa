
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'logistik-db';
const DB_VERSION = 5;
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
      photos?: string[]; // Array de paths das fotos
      synced?: boolean;
      roteiroId?: number;
      needsSync?: boolean; // Flag para indicar que precisa sincronizar
      vehiclePlate?: string; // Placa do veículo
      vehicleKm?: number; // Quilometragem do veículo
      latitude?: number; // Coordenada GPS latitude
      longitude?: number; // Coordenada GPS longitude
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
    console.log('addOccurrence - Dados recebidos:', occurrence);

    // Se não tem roteiroId, pega o roteiro ativo do localStorage
    if (!occurrence.roteiroId && typeof window !== 'undefined') {
      const activeRoteiroData = localStorage.getItem('currentRoteiroData');
      console.log('addOccurrence - Dados do localStorage:', activeRoteiroData);

      if (activeRoteiroData) {
        const data = JSON.parse(activeRoteiroData);
        console.log('addOccurrence - Dados parseados:', data);

        if (data.apiRoteiroId) {
          occurrence.roteiroId = data.apiRoteiroId;
          console.log('addOccurrence - roteiroId atribuído:', data.apiRoteiroId);
        } else {
          console.log('addOccurrence - ERRO: apiRoteiroId não encontrado!');
        }
      } else {
        console.log('addOccurrence - ERRO: Nenhum roteiro ativo no localStorage!');
      }
    } else {
      console.log('addOccurrence - roteiroId já existe:', occurrence.roteiroId);
    }

    console.log('addOccurrence - Salvando ocorrência final:', occurrence);
    const result = await db.add(OCCURRENCES_STORE, occurrence as any);
    console.log('addOccurrence - Resultado do salvamento:', result);
    return result;
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
          console.log('Dados do roteiro ativo no localStorage:', activeRoteiroData);

          if (activeRoteiroData) {
            const data = JSON.parse(activeRoteiroData);
            console.log('Dados parseados do roteiro:', data);

            if (data.apiRoteiroId) {
              console.log(`Buscando ocorrências para o roteiro ID: ${data.apiRoteiroId}`);
              // Buscar ocorrências do roteiro ativo - sempre retornar array (pode ser vazio)
              const occurrences = await db.getAllFromIndex(OCCURRENCES_STORE, 'roteiroId', data.apiRoteiroId);
              console.log(`Ocorrências encontradas para roteiro ${data.apiRoteiroId}:`, occurrences);
              return occurrences || [];
            } else {
              console.log('Roteiro não tem apiRoteiroId');
            }
          } else {
            console.log('Nenhum dado de roteiro ativo no localStorage');
          }
        }

        // Se não há roteiro ativo no localStorage, retornar array vazio
        // Não buscar ocorrências órfãs para evitar misturar roteiros
        console.log('Retornando array vazio - sem roteiro ativo');
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

// Funções para sincronização offline
export const syncService = {
  async markForSync(occurrenceId: number) {
    const database = await initDB();
    const occurrence = await database.get(OCCURRENCES_STORE, occurrenceId);
    if (occurrence) {
      occurrence.needsSync = true;
      occurrence.synced = false;
      await database.put(OCCURRENCES_STORE, occurrence);
    }
  },

  async getUnsyncedData() {
    const database = await initDB();
    const occurrences = await database.getAll(OCCURRENCES_STORE);
    return occurrences.filter(occ => occ.needsSync || !occ.synced);
  },

  async isOnline(): Promise<boolean> {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine;
  },

  async syncAllData(apiBaseUrl: string) {
    if (!await this.isOnline()) {
      console.log('Dispositivo offline, sincronização cancelada');
      return { success: false, message: 'Dispositivo offline' };
    }

    try {
      const unsyncedData = await this.getUnsyncedData();
      console.log(`Sincronizando ${unsyncedData.length} itens...`);

      let syncedCount = 0;
      let errorCount = 0;

      for (const occurrence of unsyncedData) {
        try {
          const success = await this.syncSingleOccurrence(occurrence, apiBaseUrl);
          if (success) {
            // Marcar como sincronizado no banco local
            await db.updateOccurrenceSync(occurrence.id, true);
            syncedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Erro ao sincronizar ocorrência:', error);
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        message: `Sincronizados: ${syncedCount}, Erros: ${errorCount}`,
        syncedCount,
        errorCount
      };
    } catch (error) {
      console.error('Erro durante sincronização:', error);
      return { success: false, message: 'Erro durante sincronização' };
    }
  },

  async syncSingleOccurrence(occurrence: any, apiBaseUrl: string): Promise<boolean> {
    try {
      const formData = new FormData();

      // Dados obrigatórios para a API Django
      formData.append('vehicle_plate', occurrence.vehiclePlate || '');
      formData.append('vehicle_km', occurrence.vehicleKm || '0');
      formData.append('scanned_code', occurrence.scannedCode);
      formData.append('occurrence_type', occurrence.occurrence);
      formData.append('occurrence_datetime', occurrence.timestamp);

      // Dados opcionais
      if (occurrence.receiverName) {
        formData.append('receiver_name', occurrence.receiverName);
      }
      if (occurrence.receiverDocument) {
        formData.append('receiver_document', occurrence.receiverDocument);
      }

      // Coordenadas GPS (se disponíveis)
      if (occurrence.latitude) {
        formData.append('latitude', occurrence.latitude.toString());
      }
      if (occurrence.longitude) {
        formData.append('longitude', occurrence.longitude.toString());
      }

      // Anexar fotos se existirem
      if (occurrence.photos && occurrence.photos.length > 0) {
        for (let i = 0; i < occurrence.photos.length; i++) {
          const photoPath = occurrence.photos[i];
          try {
            // Converter data URL em blob se necessário
            if (photoPath.startsWith('data:')) {
              const blob = await dataURLtoBlob(photoPath);
              formData.append('photos', blob, `photo_${i}.jpg`);
            } else {
              // Se for um path de arquivo, anexar diretamente
              formData.append('photos', photoPath);
            }
          } catch (photoError) {
            console.error('Erro ao processar foto:', photoError);
          }
        }
      }

      const response = await fetch(`${apiBaseUrl}/api/`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Ocorrência sincronizada:', result);
        return true;
      } else {
        const error = await response.text();
        console.error('Erro na API:', error);
        return false;
      }
    } catch (error) {
      console.error('Erro ao sincronizar ocorrência individual:', error);
      return false;
    }
  },

  async startBackgroundSync() {
    // Verificar se está online a cada 30 segundos
    setInterval(async () => {
      if (await this.isOnline()) {
        const unsyncedCount = (await this.getUnsyncedData()).length;
        if (unsyncedCount > 0) {
          console.log(`${unsyncedCount} itens precisam ser sincronizados`);
          // Notificar usuário que existem dados para sincronizar
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('unsyncedData', {
              detail: { count: unsyncedCount }
            }));
          }
        }
      }
    }, 30000);
  }
};
