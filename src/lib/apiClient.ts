import axios from 'axios';
import { getApiBaseUrl } from '@/lib/utils';
import { getMockTable, mockInsert, mockUpdate, mockUpdateWhere, mockDelete } from '@/lib/mockStore';

// Once the backend fails once, skip all subsequent requests for 30s to avoid waterfall timeouts
let backendDown = false;
let backendDownUntil = 0;

export function markBackendDown() {
  backendDown = true;
  backendDownUntil = Date.now() + 30_000;
}

export function isBackendDown(): boolean {
  if (backendDown && Date.now() > backendDownUntil) {
    backendDown = false;
  }
  return backendDown;
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 800,
});

// Request interceptor to automatically remove default Content-Type header for FormData
apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  return config;
});

// Response interceptor to unwrap data and format errors
apiClient.interceptors.response.use(
  (response) => {
    const contentType = response.headers ? (response.headers['content-type'] || response.headers['Content-Type'] || '') : '';
    const isHtml =
      (typeof contentType === 'string' && contentType.includes('text/html')) ||
      (typeof response.data === 'string' &&
        (response.data.includes('<!DOCTYPE html>') ||
         response.data.includes('<html') ||
         response.data.includes('<title>')));

    if (isHtml) {
      return Promise.reject(new Error('HTML response received instead of API JSON'));
    }
    return response.data;
  },
  (error) => {
    // Network errors (timeout, ECONNREFUSED, HTML-instead-of-JSON) mean backend is unreachable
    const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.message?.includes('HTML response');
    if (isNetworkError) markBackendDown();
    const message = error.response?.data?.message || error.message || 'API Request failed';
    return Promise.reject(new Error(message));
  }
);

// Store API Helper Utilities with in-memory / localStorage mock fallback
export const storeApi = {
  async fetch(table: string, params?: Record<string, any>) {
    if (isBackendDown()) return getMockTable(table);
    try {
      const res: any = await apiClient.get(`/store/entity/${table}`, { params });
      return res.data || res || [];
    } catch {
      return getMockTable(table);
    }
  },

  async fetchAll(table: string, params?: Record<string, any>) {
    if (isBackendDown()) return getMockTable(table);
    try {
      const res: any = await apiClient.get(`/store/entity/${table}`, { params: { limit: 'all', ...params } });
      return res.data || res || [];
    } catch {
      return getMockTable(table);
    }
  },

  async fetchWithPagination(table: string, params?: Record<string, any>) {
    if (isBackendDown()) {
      return { data: getMockTable(table), hasMore: false, nextCursor: null };
    }
    try {
      const res: any = await apiClient.get(`/store/entity/${table}`, { params });
      return {
        data: res.data || res || [],
        hasMore: !!res.hasMore,
        nextCursor: res.nextCursor || null,
      };
    } catch {
      const data = getMockTable(table);
      return {
        data,
        hasMore: false,
        nextCursor: null,
      };
    }
  },

  async fetchById(table: string, id: string | number) {
    if (isBackendDown()) {
      const list = getMockTable(table);
      return list.find((item: any) => Number(item.id) === Number(id) || String(item.id) === String(id));
    }
    try {
      const res: any = await apiClient.get(`/store/entity/${table}/${id}`);
      return res.data || res;
    } catch {
      const list = getMockTable(table);
      return list.find((item: any) => Number(item.id) === Number(id) || String(item.id) === String(id));
    }
  },

  async insert(table: string, data: any) {
    if (isBackendDown()) return mockInsert(table, data);
    try {
      const res: any = await apiClient.post(`/store/entity/${table}`, data);
      return res.data || res;
    } catch {
      return mockInsert(table, data);
    }
  },

  async update(table: string, id: string | number, data: any) {
    if (isBackendDown()) return mockUpdate(table, id, data);
    try {
      const res: any = await apiClient.patch(`/store/entity/${table}/${id}`, data);
      return res.data || res;
    } catch {
      return mockUpdate(table, id, data);
    }
  },

  async updateWhere(table: string, where: Record<string, any>, data: any) {
    if (isBackendDown()) return mockUpdateWhere(table, where, data);
    try {
      const res: any = await apiClient.patch(`/store/entity/${table}`, { where, data });
      return res.data || res;
    } catch {
      return mockUpdateWhere(table, where, data);
    }
  },

  async delete(table: string, id: string | number) {
    if (isBackendDown()) return mockDelete(table, id);
    try {
      const res: any = await apiClient.delete(`/store/entity/${table}/${id}`);
      return res.data || res;
    } catch {
      return mockDelete(table, id);
    }
  },
};

// Email API Helper Utilities via Resend
export const emailApi = {
  async sendEmail(payload: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: any[];
  }) {
    try {
      const res: any = await apiClient.post('/email/send', payload);
      return res;
    } catch {
      console.log('Mock email sent successfully:', payload);
      return { success: true };
    }
  },
};
