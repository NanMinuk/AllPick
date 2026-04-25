import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getSessionId() {
  let sid = localStorage.getItem('session_id');
  if (!sid) {
    sid = uuidv4();
    localStorage.setItem('session_id', sid);
  }
  return sid;
}

const api = axios.create({ baseURL: BASE_URL, timeout: 60000 });

api.interceptors.request.use(config => {
  config.headers['x-session-id'] = getSessionId();
  return config;
});

export const productsApi = {
  getAll: (params) => api.get('/products', { params }).then(r => r.data),
  getById: (id) => api.get(`/products/${id}`).then(r => r.data),
};

export const familyApi = {
  get: () => api.get('/family').then(r => r.data),
  save: (members) => api.post('/family', { members }).then(r => r.data),
};

export const aiApi = {
  recommend: (members) => api.post('/ai/recommend', { members }).then(r => r.data),
  analyze: (productId, members) =>
    api.post('/ai/analyze', { productId, members }).then(r => r.data),
};
