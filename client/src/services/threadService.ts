import api from './api';
import type { CreateThreadPayload } from '../types/thread';

export const threadService = {
    getThreads: (params: Record<string, string | number>) => api.get('/threads', { params }),
    getThread: (id: string) => api.get(`/threads/${id}`),
    create: (data: CreateThreadPayload) => api.post('/threads', data),
    update: (id: string, data: Partial<CreateThreadPayload>) => api.put(`/threads/${id}`, data),
    delete: (id: string) => api.delete(`/threads/${id}`),
    vote: (id: string, type: 'up' | 'down') => api.post(`/threads/${id}/vote`, { type }),
};
