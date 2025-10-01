import { getApiUrl, API_CONFIG } from './config';

// Real API service for Django integration
export interface OccurrenceData {
  id?: number;
  scannedCode: string;
  occurrence: string;
  timestamp: string;
  receiverName?: string;
  receiverDocument?: string;
  photos?: string[];
  photo_urls?: string[];
  photoBase64?: string;
  latitude?: number;
  longitude?: number;
  synced?: boolean;
  needsSync?: boolean;
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

const API_BASE_URL = API_CONFIG.baseUrl;

export const apiService = {
  /**
   * Verifica se há conexão com a internet
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine;
  },

  /**
   * Sincroniza uma ocorrência com a API - funciona offline salvando localmente
   */
  async syncOccurrence(occurrence: OccurrenceData): Promise<SyncResult> {
    console.log('Sincronizando ocorrência com Django API:', occurrence);

    // Se offline, retornar sucesso pois já está salvo localmente
    if (!this.isOnline()) {
      console.log('Offline - ocorrência já salva localmente');
      return {
        success: true,
        id: occurrence.id,
        error: 'Salvo localmente (offline)'
      };
    }

    try {
      const formData = new FormData();

      // Dados obrigatórios conforme a nova API
      formData.append('code', occurrence.scannedCode);
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
      if (occurrence.latitude !== undefined) {
        formData.append('latitude', occurrence.latitude.toString());
      }
      if (occurrence.longitude !== undefined) {
        formData.append('longitude', occurrence.longitude.toString());
      }

      // Se houver foto em base64 (offline), fazer upload primeiro
      if (occurrence.photoBase64) {
        console.log('Enviando foto em base64 para R2...');
        const { photoUploadService } = await import('./photo-upload-service');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ocorrencia_${timestamp}.jpg`;

        try {
          const r2Url = await photoUploadService.uploadBase64ToR2(occurrence.photoBase64, filename);
          console.log('Foto enviada para R2:', r2Url);
          formData.append('photo_urls', r2Url);
        } catch (uploadError) {
          console.error('Erro ao fazer upload da foto:', uploadError);
          // Continua sem a foto se houver erro
        }
      } else {
        // Anexar URLs de fotos se existirem (conforme nova API)
        const photoUrls = occurrence.photo_urls || occurrence.photos || [];
        if (photoUrls.length > 0 && photoUrls[0] !== 'offline') {
          console.log('Adicionando photo_urls:', photoUrls);
          photoUrls.forEach((url) => {
            formData.append('photo_urls', url);
          });
        } else {
          console.log('Nenhuma photo_url para enviar');
        }
      }

      console.log('Enviando FormData para API:', {
        code: occurrence.scannedCode,
        occurrence_type: occurrence.occurrence,
        photo_urls_count: occurrence.photo_urls?.length || 0
      });

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.occurrences), {
        method: 'POST',
        credentials: 'include',
        body: formData,
        // Não definir Content-Type para FormData - o browser define automaticamente
      });

      console.log('Resposta da API:', response.status, response.statusText);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.indexOf('application/json') !== -1) {
          const result = await response.json();
          console.log('Ocorrência sincronizada com sucesso:', result);
          return {
            success: true,
            id: result.occurrence_id || occurrence.id
          };
        } else {
          const errorText = await response.text();
          console.error('Received non-JSON response:', errorText);
          return {
            success: false,
            error: 'Server returned non-JSON response.'
          };
        }
      } else {
        const errorText = await response.text();
        console.error('Erro na API Django:', response.status, errorText);
        return {
          success: false,
          error: `Erro ${response.status}: ${errorText}`
        };
      }
    } catch (error) {
      console.error('Erro ao sincronizar com Django API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão'
      };
    }
  },

  async syncMultipleOccurrences(occurrences: OccurrenceData[]): Promise<{ successes: number; failures: number; results: SyncResult[] }> {
    console.log(`Sincronizando ${occurrences.length} ocorrências...`);

    const results: SyncResult[] = [];
    let successes = 0;
    let failures = 0;

    // Sincronizar uma por vez para evitar sobrecarga
    for (const occurrence of occurrences) {
      try {
        const result = await this.syncOccurrence(occurrence);
        results.push(result);

        if (result.success) {
          successes++;
        } else {
          failures++;
        }

        // Pequena pausa entre requisições
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('Erro ao sincronizar ocorrência:', error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
        failures++;
      }
    }

    console.log(`Sincronização completa: ${successes} sucessos, ${failures} falhas`);
    return { successes, failures, results };
  },

  // Verificar se a API está acessível
  async checkConnection(): Promise<boolean> {
    try {
      console.log(`Verificando conexão com ${API_BASE_URL}/health/`);
      const response = await fetch(`${API_BASE_URL}/health/`, {
        method: 'GET',
        credentials: 'include',
        // Remove timeout que não é suportado pelo fetch API
      });
      console.log('Status da verificação de conexão:', response.status);
      return response.ok;
    } catch (error) {
      console.log('API não acessível:', error);
      return false;
    }
  }
};