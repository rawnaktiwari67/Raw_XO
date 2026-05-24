import { Request, Response } from 'express';
import Tour from '../models/Tour';
import { successResponse, errorResponse } from '../utils/apiResponse';

type LiveTour = {
    _id: string;
    eventName: string;
    city: string;
    country: string;
    venue: string;
    date: string;
    ticketsAvailable: boolean;
    ticketUrl: string;
    isActive: boolean;
};

type DistrictCityConfig = {
    key: string;
    city: string;
};

const DISTRICT_CITY_PAGES: DistrictCityConfig[] = [
    { key: 'delhi', city: 'Delhi/NCR' },
    { key: 'mumbai', city: 'Mumbai' },
    { key: 'bengaluru', city: 'Bengaluru' },
    { key: 'hyderabad', city: 'Hyderabad' },
    { key: 'pune', city: 'Pune' },
    { key: 'kolkata', city: 'Kolkata' },
    { key: 'chennai', city: 'Chennai' },
];
const DISTRICT_BASE_URL = 'https://www.district.in';
const LIVE_TOUR_CACHE_MS = 10 * 60 * 1000;
const liveTourCache = new Map<string, { expiresAt: number; tours: LiveTour[] }>();
const NON_MUSIC_PATTERN =
    /\b(ipl|screening|cricket|match|comedy|theatre|theater|movie|film|kids|play area|water park|brunch)\b/i;
const eventPattern =
    /\\"EventData\\":\{\\"event_id\\":\\"([^\\"]+)\\",\\"name\\":\\"((?:\\\\.|[^\\"])*)\\".*?\\"venue_name\\":\\"((?:\\\\.|[^\\"])*)\\".*?\\"price_string\\":\\"((?:\\\\.|[^\\"])*)\\".*?\\"date_string\\":\\"((?:\\\\.|[^\\"])*)\\".*?\\"event_slug\\":\\"([^\\"]+)\\".*?\\"start_time_epoch\\":(\d+).*?\\"city\\":\\"((?:\\\\.|[^\\"])*)\\"/g;

const decodeEscaped = (value: string): string => JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;

const normalizeCity = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '');
const cleanText = (value: unknown, maxLength: number): string =>
    typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const getDistrictKeys = (city?: string): string[] => {
    if (!city) return DISTRICT_CITY_PAGES.map((entry) => entry.key);

    const normalized = normalizeCity(city);
    const matches = DISTRICT_CITY_PAGES.filter((entry) => {
        const entryKey = normalizeCity(entry.key);
        const entryCity = normalizeCity(entry.city);
        return (
            normalized.includes(entryKey) ||
            normalized.includes(entryCity) ||
            entryKey.includes(normalized) ||
            entryCity.includes(normalized)
        );
    });

    return (matches.length > 0 ? matches : DISTRICT_CITY_PAGES).map((entry) => entry.key);
};

const extractDistrictTours = (html: string): LiveTour[] => {
    const tours: LiveTour[] = [];

    for (const match of html.matchAll(eventPattern)) {
        const eventId = match[1];
        const eventName = decodeEscaped(match[2]);
        const venue = decodeEscaped(match[3]).split('|')[0].trim();
        const priceString = decodeEscaped(match[4]);
        const eventSlug = match[6];
        const startEpoch = Number.parseInt(match[7], 10);
        const city = decodeEscaped(match[8]).trim();
        const musicSignature = `${eventName} ${venue} ${eventSlug}`;

        if (!eventId || !eventName || !Number.isFinite(startEpoch) || !city || NON_MUSIC_PATTERN.test(musicSignature)) {
            continue;
        }

        tours.push({
            _id: `district-${eventId}`,
            eventName,
            city,
            country: 'India',
            venue,
            date: new Date(startEpoch * 1000).toISOString(),
            ticketsAvailable: !/sold out|coming soon/i.test(priceString),
            ticketUrl: `${DISTRICT_BASE_URL}/events/${eventSlug}-buy-tickets`,
            isActive: true,
        });
    }

    return tours;
};

const fetchDistrictTours = async (city?: string): Promise<LiveTour[]> => {
    const cacheKey = normalizeCity(city || 'all') || 'all';
    const cached = liveTourCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.tours;
    }

    const selectedKeys = getDistrictKeys(city);
    const pages = await Promise.all(
        selectedKeys.map(async (key) => {
            try {
                const response = await fetch(`${DISTRICT_BASE_URL}/activities/music-in-${key}`);
                if (!response.ok) return '';
                return response.text();
            } catch {
                return '';
            }
        })
    );

    const toursById = new Map<string, LiveTour>();

    for (const page of pages) {
        for (const tour of extractDistrictTours(page)) {
            if (city && !tour.city.toLowerCase().includes(city.toLowerCase())) continue;

            const existing = toursById.get(tour._id);
            if (!existing || new Date(tour.date).getTime() < new Date(existing.date).getTime()) {
                toursById.set(tour._id, tour);
            }
        }
    }

    const tours = Array.from(toursById.values())
        .filter((tour) => new Date(tour.date).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    liveTourCache.set(cacheKey, { tours, expiresAt: Date.now() + LIVE_TOUR_CACHE_MS });
    return tours;
};

// GET /tours?city=
export const getTours = async (req: Request, res: Response): Promise<void> => {
    try {
        const city = typeof req.query.city === 'string' ? req.query.city : undefined;
        const liveTours = await fetchDistrictTours(city);
        res.json(successResponse(liveTours));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// POST /tours (admin only - no admin middleware in MVP, use env guard)
export const createTour = async (req: Request, res: Response): Promise<void> => {
    try {
        const eventName = cleanText(req.body.eventName, 160);
        const city = cleanText(req.body.city, 80);
        const country = cleanText(req.body.country, 80);
        const venue = cleanText(req.body.venue, 160);
        const ticketUrl = cleanText(req.body.ticketUrl, 500);
        const date = new Date(String(req.body.date || ''));
        const ticketsAvailable = Boolean(req.body.ticketsAvailable);
        if (!eventName || !city || !country || !date) {
            res.status(400).json(errorResponse('eventName, city, country, and date are required'));
            return;
        }
        if (Number.isNaN(date.getTime())) {
            res.status(400).json(errorResponse('Valid date is required'));
            return;
        }
        const tour = await Tour.create({ eventName, city, country, venue, date, ticketsAvailable, ticketUrl });
        res.status(201).json(successResponse(tour, 'Tour created'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};

// PUT /tours/:id
export const updateTour = async (req: Request, res: Response): Promise<void> => {
    try {
        const updates: Record<string, unknown> = {};
        for (const field of ['eventName', 'city', 'country', 'venue', 'ticketUrl'] as const) {
            if (req.body[field] !== undefined) {
                updates[field] = cleanText(req.body[field], field === 'ticketUrl' ? 500 : 160);
            }
        }
        if (req.body.date !== undefined) {
            const date = new Date(String(req.body.date));
            if (Number.isNaN(date.getTime())) {
                res.status(400).json(errorResponse('Valid date is required'));
                return;
            }
            updates.date = date;
        }
        if (req.body.ticketsAvailable !== undefined) updates.ticketsAvailable = Boolean(req.body.ticketsAvailable);
        if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

        const tour = await Tour.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!tour) {
            res.status(404).json(errorResponse('Tour not found'));
            return;
        }
        res.json(successResponse(tour, 'Tour updated'));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
};
