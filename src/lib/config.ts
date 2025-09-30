// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://logistik-production.up.railway.app',

  endpoints: {
    login: '/auth/api/login/',
    logout: '/auth/api/logout/',
    verify: '/auth/api/verify/',
  }
};

// Helper function to get full API URL
export function getApiUrl(endpoint: string): string {
  const url = `${API_CONFIG.baseUrl}${endpoint}`;
  console.log('API URL:', url); // Debug
  return url;
}