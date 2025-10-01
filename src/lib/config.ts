// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://logistik-production.up.railway.app',

  endpoints: {
    login: '/api/auth/login/',
    logout: '/api/auth/logout/',
    verify: '/api/auth/verify/',
    occurrences: '/api/occurrences/',
  }
};

// Helper function to get full API URL
export function getApiUrl(endpoint: string): string {
  const url = `${API_CONFIG.baseUrl}${endpoint}`;
  console.log('API URL:', url); // Debug
  return url;
}