import api from './api';
import type { Tour } from '../types/tour';

// In-memory cache of the last successful (non-empty) tours pull. Lives for the
// SPA session, so navigating away from and back to /tours paints instantly from
// this instead of showing a skeleton while a fresh (cold-start) request runs.
// The page still revalidates in the background on every mount.
let toursCache: Tour[] | null = null;

export const tourService = {
    getTours: (city?: string) => api.get('/tours', { params: city ? { city } : {} }),
    getCachedTours: (): Tour[] | null => toursCache,
    setCachedTours: (tours: Tour[]) => {
        toursCache = tours;
    },
};
