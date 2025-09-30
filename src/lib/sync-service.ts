"use client";

import { db } from './db';
import { apiService, OccurrenceData } from './api';

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
}

class SyncService {
  private isSyncing = false;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  private lastSyncTime: Date | null = null;

  constructor() {
    // Construtor vazio - sem sincronização automática
  }

  /**
   * Adiciona um listener para mudanças no status de sincronização
   */
  addSyncListener(callback: (status: SyncStatus) => void) {
    this.syncListeners.add(callback);
    // Chamar imediatamente com o status atual
    this.notifyListeners();
  }

  /**
   * Remove um listener
   */
  removeSyncListener(callback: (status: SyncStatus) => void) {
    this.syncListeners.delete(callback);
  }

  /**
   * Notifica todos os listeners sobre mudanças no status
   */
  private async notifyListeners() {
    const pendingCount = await this.getPendingCount();
    const status: SyncStatus = {
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
    };

    this.syncListeners.forEach(callback => callback(status));
  }

  /**
   * Retorna a quantidade de itens pendentes de sincronização
   */
  async getPendingCount(): Promise<number> {
    try {
      const unsyncedOccurrences = await db.getUnsyncedOccurrences();
      return unsyncedOccurrences.length;
    } catch (error) {
      console.error('Erro ao contar itens pendentes:', error);
      return 0;
    }
  }

  /**
   * Verifica se há conexão com a internet
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine;
  }

  /**
   * Sincroniza todos os dados pendentes com a API
   */
  async syncAll(): Promise<{ success: boolean; syncedCount: number; errorCount: number; message: string }> {
    if (!this.isOnline()) {
      console.log('Dispositivo offline - sincronização cancelada');
      return {
        success: false,
        syncedCount: 0,
        errorCount: 0,
        message: 'Sem conexão com a internet'
      };
    }

    if (this.isSyncing) {
      console.log('Sincronização já em andamento');
      return {
        success: false,
        syncedCount: 0,
        errorCount: 0,
        message: 'Sincronização já em andamento'
      };
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const unsyncedOccurrences = await db.getUnsyncedOccurrences();

      if (unsyncedOccurrences.length === 0) {
        console.log('Nenhum item para sincronizar');
        this.isSyncing = false;
        this.lastSyncTime = new Date();
        this.notifyListeners();
        return {
          success: true,
          syncedCount: 0,
          errorCount: 0,
          message: 'Todos os dados já estão sincronizados'
        };
      }

      console.log(`Iniciando sincronização de ${unsyncedOccurrences.length} itens...`);

      let syncedCount = 0;
      let errorCount = 0;

      // Sincronizar cada ocorrência individualmente
      for (const occurrence of unsyncedOccurrences) {
        try {
          const result = await apiService.syncOccurrence(occurrence);

          if (result.success) {
            // Marcar como sincronizado no banco local
            await db.updateOccurrenceSync(occurrence.id, true);
            syncedCount++;
            console.log(`Ocorrência ${occurrence.id} sincronizada com sucesso`);
          } else {
            errorCount++;
            console.error(`Erro ao sincronizar ocorrência ${occurrence.id}:`, result.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`Exceção ao sincronizar ocorrência ${occurrence.id}:`, error);
        }

        // Notificar progresso
        this.notifyListeners();

        // Pequena pausa entre requisições
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.lastSyncTime = new Date();
      this.isSyncing = false;
      this.notifyListeners();

      const message = errorCount === 0
        ? `${syncedCount} item(ns) sincronizado(s) com sucesso`
        : `${syncedCount} sincronizado(s), ${errorCount} com erro`;

      console.log('Sincronização concluída:', message);

      return {
        success: errorCount === 0,
        syncedCount,
        errorCount,
        message
      };
    } catch (error) {
      console.error('Erro durante sincronização:', error);
      this.isSyncing = false;
      this.notifyListeners();

      return {
        success: false,
        syncedCount: 0,
        errorCount: 0,
        message: 'Erro durante sincronização'
      };
    }
  }

  /**
   * Salva uma ocorrência localmente e tenta sincronizar se estiver online
   */
  async saveOccurrence(occurrence: Omit<OccurrenceData, 'id'>): Promise<{ success: boolean; id?: number; message: string }> {
    try {
      // Sempre salvar no IndexedDB primeiro
      const id = await db.addOccurrence({
        ...occurrence,
        synced: false,
        needsSync: true
      });

      console.log(`Ocorrência salva localmente com ID: ${id}`);

      // Se estiver online, tentar sincronizar imediatamente
      if (this.isOnline()) {
        console.log('Online - tentando sincronizar imediatamente');
        const occurrenceWithId = { ...occurrence, id: id as number };
        const result = await apiService.syncOccurrence(occurrenceWithId);

        if (result.success) {
          // Marcar como sincronizado
          await db.updateOccurrenceSync(id as number, true);
          console.log('Ocorrência sincronizada imediatamente');
          this.notifyListeners();

          return {
            success: true,
            id: id as number,
            message: 'Ocorrência salva e sincronizada'
          };
        } else {
          console.log('Falha na sincronização imediata - será sincronizado depois');
          this.notifyListeners();
        }
      } else {
        console.log('Offline - ocorrência será sincronizada quando houver conexão');
        this.notifyListeners();
      }

      return {
        success: true,
        id: id as number,
        message: this.isOnline()
          ? 'Ocorrência salva localmente (sincronização pendente)'
          : 'Ocorrência salva localmente (offline)'
      };
    } catch (error) {
      console.error('Erro ao salvar ocorrência:', error);
      return {
        success: false,
        message: 'Erro ao salvar ocorrência'
      };
    }
  }

}


// Exportar instância singleton
export const syncService = new SyncService();
