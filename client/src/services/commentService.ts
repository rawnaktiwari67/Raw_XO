import api from './api';
import type { CreateCommentPayload } from '../types/comment';

export const commentService = {
    getComments: (threadId: string, page = 1) => api.get('/comments', { params: { thread: threadId, page } }),
    create: (data: CreateCommentPayload) => api.post('/comments', data),
    update: (id: string, body: string) => api.put(`/comments/${id}`, { body }),
    delete: (id: string) => api.delete(`/comments/${id}`),
    vote: (id: string) => api.post(`/comments/${id}/vote`),
};
