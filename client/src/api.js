import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add interceptor for tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const resolveApiAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${API_ORIGIN}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
};

export default api;
export { API_BASE_URL, API_ORIGIN };
