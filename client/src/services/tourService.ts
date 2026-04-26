import api from './api';

export const tourService = {
    getTours: (city?: string) => api.get('/tours', { params: city ? { city } : {} }),
};
