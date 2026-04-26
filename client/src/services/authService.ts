import api from './api';
import type { LoginPayload, RegisterPayload } from '../types/user';

export const authService = {
    register: (data: RegisterPayload) => api.post('/auth/register', data),
    login: (data: LoginPayload) => api.post('/auth/login', data),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),
};
