import api from './api';
import type { CultureReview, MeaningEntry } from '../types/culture';

const REVIEW_STORAGE_KEY = 'raw-xo-culture-reviews';

const readReviews = (): CultureReview[] => {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as CultureReview[];
    } catch {
        return [];
    }
};

const writeReviews = (reviews: CultureReview[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
};

export const cultureService = {
    async getReviews(): Promise<CultureReview[]> {
        try {
            const response = await api.get('/culture/reviews');
            const reviews = Array.isArray(response.data?.data) ? response.data.data as CultureReview[] : [];
            return reviews;
        } catch {
            return readReviews().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
    },

    async saveReview(
        entry: MeaningEntry,
        rating: number,
        moodTag: string,
        take: string,
        authorName?: string
    ): Promise<CultureReview> {
        const fallbackReview: CultureReview = {
            id: `${entry.trackId}-${Date.now()}`,
            trackId: entry.trackId,
            title: entry.title,
            artist: entry.artist,
            albumArt: entry.albumArt,
            rating,
            moodTag,
            take,
            createdAt: new Date().toISOString(),
        };

        try {
            const response = await api.post('/culture/reviews', {
                trackId: entry.trackId,
                title: entry.title,
                artist: entry.artist,
                albumArt: entry.albumArt,
                rating,
                moodTag,
                take,
                authorName,
            });

            const review = response.data?.data as (Partial<CultureReview> & { _id?: string }) | undefined;
            if (review) {
                return {
                    id: String(review.id || review._id || fallbackReview.id),
                    trackId: review.trackId || fallbackReview.trackId,
                    title: review.title || fallbackReview.title,
                    artist: review.artist || fallbackReview.artist,
                    albumArt: review.albumArt || fallbackReview.albumArt,
                    rating: Number(review.rating || fallbackReview.rating),
                    moodTag: review.moodTag || fallbackReview.moodTag,
                    take: review.take || fallbackReview.take,
                    createdAt: review.createdAt || fallbackReview.createdAt,
                };
            }
        } catch {
            const next = [fallbackReview, ...readReviews()];
            writeReviews(next);
        }

        return fallbackReview;
    },
};
