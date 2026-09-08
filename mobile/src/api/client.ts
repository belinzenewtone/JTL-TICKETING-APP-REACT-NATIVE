import axios, { type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/useAuthStore';

// Use EXPO_PUBLIC_API_URL env-var for dev/staging, fall back to production
export const BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ?? 'https://belinzeticket.vercel.app/api/mobile';

export const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach bearer token to every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// On 401 — clear auth so AuthGate automatically redirects to login
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: unknown) => {
        if ((error as any)?.response?.status === 401) {
            await useAuthStore.getState().clearAuth();
        }
        return Promise.reject(error);
    }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
    login: (email: string, password: string) =>
        api.post<{ token: string; user: { id: string; email: string; name: string; role: string } }>('/auth/login', { email, password }),
    me: () => api.get('/me'),
};

// ── Tickets ───────────────────────────────────────────────────────────────────
export const ticketsApi = {
    list: (params?: Record<string, string>) => api.get('/tickets', { params }),
    get: (id: string) => api.get(`/tickets/${id}`),
    create: (data: unknown) => api.post('/tickets', data),
    update: (id: string, data: unknown) => api.patch(`/tickets/${id}`, data),
    delete: (id: string) => api.delete(`/tickets/${id}`),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
    list: (params?: Record<string, string>) => api.get('/tasks', { params }),
    create: (data: unknown) => api.post('/tasks', data),
    update: (id: string, data: unknown) => api.patch(`/tasks/${id}`, data),
    delete: (id: string) => api.delete(`/tasks/${id}`),
};

// ── Portal ────────────────────────────────────────────────────────────────────
export const portalApi = {
    myTickets: () => api.get('/portal/tickets'),
    submit: (data: unknown) => api.post('/portal/tickets', data),
};

// ── Comments ──────────────────────────────────────────────────────────────────
export const commentsApi = {
    list: (ticketId: string) => api.get('/comments', { params: { ticket_id: ticketId } }),
    create: (data: unknown) => api.post('/comments', data),
    delete: (id: string) => api.delete(`/comments/${id}`),
};

// ── Activity ──────────────────────────────────────────────────────────────────
export const activityApi = {
    list: (ticketId: string) => api.get('/activity', { params: { ticket_id: ticketId } }),
};

// ── Staff ─────────────────────────────────────────────────────────────────────
export const staffApi = {
    list: () => api.get('/staff'),
};

// ── Knowledge Base ────────────────────────────────────────────────────────────
export const kbApi = {
    list: (params?: Record<string, string>) => api.get('/knowledge-base', { params }),
    create: (data: unknown) => api.post('/knowledge-base', data),
    update: (id: string, data: unknown) => api.patch(`/knowledge-base/${id}`, data),
    delete: (id: string) => api.delete(`/knowledge-base/${id}`),
};

// ── Machines ──────────────────────────────────────────────────────────────────
export const machinesApi = {
    list: (params?: Record<string, string>) => api.get('/machines', { params }),
    create: (data: unknown) => api.post('/machines', data),
    update: (id: string, data: unknown) => api.patch(`/machines/${id}`, data),
    delete: (id: string) => api.delete(`/machines/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
    stats: () => api.get('/dashboard'),
};

// ── Entries (Email Dashboard) ─────────────────────────────────────────────────
export const entriesApi = {
    list: (params?: Record<string, string>) => api.get('/entries', { params }),
    create: (data: unknown) => api.post('/entries', data),
    update: (id: string, data: unknown) => api.patch(`/entries/${id}`, data),
    delete: (id: string) => api.delete(`/entries/${id}`),
};

// ── Procurement ───────────────────────────────────────────────────────────────
export const procurementApi = {
    list: (params?: Record<string, string>) => api.get('/procurement', { params }),
    create: (data: unknown) => api.post('/procurement', data),
    get: (id: string) => api.get(`/procurement/${id}`),
    update: (id: string, data: unknown) => api.patch(`/procurement/${id}`, data),
    approve: (id: string, notes?: string) => api.patch(`/procurement/${id}`, { action: 'approve', signed_date: new Date().toISOString().split('T')[0], notes }),
    reject: (id: string, reason: string) => api.patch(`/procurement/${id}`, { action: 'reject', reason }),
    delete: (id: string) => api.delete(`/procurement/${id}`),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
    get: (range?: string) => api.get('/reports', { params: range ? { range } : {} }),
};
