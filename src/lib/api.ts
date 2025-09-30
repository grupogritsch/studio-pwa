// Real API service for Django integration
export interface OccurrenceData {
  id?: number;
  scannedCode: string;
  occurrence: string;
  timestamp: string;
  receiverName?: string;
  receiverDocument?: string;
  photos?: string[];
  roteiroId?: number;
  vehiclePlate?: string;
  vehicleKm?: number;
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

const API_BASE_URL = 'https://logistik-production.up.railway.app';

export const apiService = {
  /**
   * Verifica se há conexão com a internet
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine;
  },

  /**
   * Cria um roteiro - REQUER conexão online
   */
  async createRoteiro(roteiroData: RoteiroData): Promise<RoteiroResult> {
    // Roteiro DEVE ser criado online
    if (!this.isOnline()) {
      console.error('Tentativa de criar roteiro offline');
      return {
        success: false,
        error: 'É necessário estar online para iniciar um roteiro'
      };
    }

    console.log('Creating roteiro in Django API:', roteiroData);

    try {
      // Criar roteiro através da API de ocorrências
      // Vamos fazer uma chamada especial para criar o roteiro
      const formData = new FormData();
      formData.append('scanned_code', 'ROTEIRO_INIT');
      formData.append('occurrence_type', 'outros');
      formData.append('occurrence_datetime', roteiroData.startDate);
      formData.append('vehicle_plate', roteiroData.vehiclePlate);
      formData.append('vehicle_km', roteiroData.startKm.toString());

      const response = await fetch(`${API_BASE_URL}/api/`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.indexOf('application/json') !== -1) {
          const result = await response.json();
          console.log('Roteiro created with API ID:', result.roteiro_id);

          // Remover a ocorrência inicial que foi criada apenas para criar o roteiro
          // (isso é uma gambiarra temporária)

          return {
            success: true,
            id: result.roteiro_id
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
        console.error('Erro ao criar roteiro:', errorText);
        return {
          success: false,
          error: errorText
        };
      }
    } catch (error) {
      console.error('Erro ao criar roteiro:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão com o servidor'
      };
    }
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

      // Dados obrigatórios para a API Django
      formData.append('scanned_code', occurrence.scannedCode);
      formData.append('occurrence_type', occurrence.occurrence);
      formData.append('occurrence_datetime', occurrence.timestamp);

      // Dados do roteiro (se disponível)
      if (occurrence.roteiroId) {
        formData.append('roteiro_id', occurrence.roteiroId.toString());
      }

      // Sempre enviar vehicle_plate e vehicle_km para casos onde o roteiro não existe
      if (occurrence.vehiclePlate) {
        formData.append('vehicle_plate', occurrence.vehiclePlate);
      }
      if (occurrence.vehicleKm !== undefined && occurrence.vehicleKm !== null) {
        formData.append('vehicle_km', occurrence.vehicleKm.toString());
      }

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
        console.log('Processando fotos para envio:', occurrence.photos);

        for (let i = 0; i < occurrence.photos.length; i++) {
          const photoPath = occurrence.photos[i];
          console.log(`Processando foto ${i}:`, photoPath);

          try {
            // Se for um data URL, converter para blob
            if (photoPath.startsWith('data:')) {
              console.log(`Foto ${i} é data URL, convertendo para blob...`);
              const response = await fetch(photoPath);
              const blob = await response.blob();
              console.log(`Blob criado para foto ${i}:`, blob.size, 'bytes');
              formData.append('photos', blob, `photo_${i}.jpg`);
            } else {
              // Para paths de arquivo, tentar carregar do localStorage ou cache
              console.log(`Foto ${i} é path de arquivo:`, photoPath);

              // Tentar buscar a foto no cache/storage local
              try {
                // Se o path for um nome de arquivo, podemos tentar recuperá-lo
                // Por enquanto, vamos logar que não conseguimos processar
                console.warn(`Não é possível acessar arquivo local: ${photoPath}`);
                formData.append('photo_paths', photoPath);
              } catch (fileError) {
                console.error(`Erro ao acessar arquivo ${photoPath}:`, fileError);
              }
            }
          } catch (photoError) {
            console.error(`Erro ao processar foto ${i}:`, photoError);
          }
        }
      } else {
        console.log('Nenhuma foto para processar');
      }

      console.log('Enviando FormData para API:', {
        scanned_code: occurrence.scannedCode,
        occurrence_type: occurrence.occurrence,
        roteiro_id: occurrence.roteiroId,
        vehicle_plate: occurrence.vehiclePlate,
        vehicle_km: occurrence.vehicleKm,
        photos_count: occurrence.photos?.length || 0
      });

      const response = await fetch(`${API_BASE_URL}/api/`, {
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