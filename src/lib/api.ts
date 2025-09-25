// Simulated API service for syncing occurrences
export interface OccurrenceData {
  id?: number;
  scannedCode: string;
  occurrence: string;
  timestamp: string;
  receiverName?: string;
  receiverDocument?: string;
  photo?: string | Blob;
  roteiroId?: number;
}

export interface RoteiroData {
  vehiclePlate: string;
  startKm: number;
  startDate: string;
}

export interface RoteiroResult {
  success: boolean;
  id?: number;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  id?: number;
  error?: string;
}

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const apiService = {
  async createRoteiro(roteiroData: RoteiroData): Promise<RoteiroResult> {
    console.log('Creating roteiro in API:', roteiroData);

    // Simulate network delay
    await delay(1000 + Math.random() * 1500);

    // Simulate 98% success rate for roteiro creation
    if (Math.random() > 0.02) {
      const roteiroId = Math.floor(Math.random() * 1000000) + 1000;
      console.log('Roteiro created with API ID:', roteiroId);

      return {
        success: true,
        id: roteiroId
      };
    } else {
      return {
        success: false,
        error: 'Erro de conexão com o servidor'
      };
    }
  },

  async syncOccurrence(occurrence: OccurrenceData): Promise<SyncResult> {
    // Simulate network delay
    await delay(1000 + Math.random() * 2000);

    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      return {
        success: true,
        id: occurrence.id || Math.floor(Math.random() * 1000000)
      };
    } else {
      return {
        success: false,
        error: 'Erro de conexão com o servidor'
      };
    }
  },

  async syncMultipleOccurrences(occurrences: OccurrenceData[]): Promise<{ successes: number; failures: number; results: SyncResult[] }> {
    const results = await Promise.all(
      occurrences.map(occ => this.syncOccurrence(occ))
    );

    const successes = results.filter(r => r.success).length;
    const failures = results.length - successes;

    return { successes, failures, results };
  }
};