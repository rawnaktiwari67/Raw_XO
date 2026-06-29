import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { tourService } from '../services/tourService';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import type { Tour } from '../types/tour';
import SpotlightCard from '../components/ui/SpotlightCard';

const FALLBACK_TOURS: Tour[] = [
    {
        _id: 'fallback-1',
        eventName: 'Seedhe Maut Live',
        city: 'Delhi/NCR',
        country: 'India',
        venue: 'Jawaharlal Nehru Stadium',
        date: '2026-06-14T19:30:00.000Z',
        ticketsAvailable: true,
        ticketUrl: 'https://www.district.in/activities/music-in-delhi',
        isActive: true,
    },
    {
        _id: 'fallback-2',
        eventName: 'Diljit Dosanjh Stadium Night',
        city: 'Mumbai',
        country: 'India',
        venue: 'MMRDA Grounds',
        date: '2026-06-23T20:00:00.000Z',
        ticketsAvailable: true,
        ticketUrl: 'https://www.district.in/activities/music-in-mumbai',
        isActive: true,
    },
    {
        _id: 'fallback-3',
        eventName: 'Prateek Kuhad Open Air',
        city: 'Bengaluru',
        country: 'India',
        venue: 'Venue to be announced',
        date: '2026-07-01T19:30:00.000Z',
        ticketsAvailable: true,
        ticketUrl: 'https://www.district.in/activities/music-in-bengaluru',
        isActive: true,
    },
    {
        _id: 'fallback-4',
        eventName: 'KR$NA Club Set',
        city: 'Pune',
        country: 'India',
        venue: 'Phoenix Marketcity',
        date: '2026-07-12T20:30:00.000Z',
        ticketsAvailable: true,
        ticketUrl: 'https://www.district.in/activities/music-in-pune',
        isActive: true,
    },
];

const dayFormatter = new Intl.DateTimeFormat('en-US', { day: '2-digit' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

const extractArtist = (eventName: string): string => {
    const cleaned = eventName
        .replace(/\b(live|concert|tour|india|stadium|night|club set|open air|presents)\b/gi, ' ')
        .replace(/[|:-].*$/, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned || eventName;
};

const spotifySearchUrl = (artist: string) =>
    `https://open.spotify.com/search/${encodeURIComponent(artist)}`;

const cityTone = (index: number) =>
    [
        'from-emerald-300/20 via-white/[0.035] to-transparent',
        'from-amber/20 via-white/[0.035] to-transparent',
        'from-sky-300/16 via-white/[0.035] to-transparent',
        'from-rose-300/16 via-white/[0.035] to-transparent',
    ][index % 4];

export default function Tours() {
    useDocumentMeta({
        title: 'Tours — Raw XO',
        description: 'Live music listings for Indian cities, with quick links out to tickets.',
    });
    const [tours, setTours] = useState<Tour[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeCity, setActiveCity] = useState('All Cities');
    const [sourceNote, setSourceNote] = useState('District live listings with Spotify artist discovery');

    useEffect(() => {
        let mounted = true;

        const loadTours = async () => {
            setLoading(true);
            try {
                const response = await tourService.getTours();
                const incoming = Array.isArray(response.data?.data) ? (response.data.data as Tour[]) : [];
                if (!mounted) return;

                if (incoming.length === 0) {
                    setTours(FALLBACK_TOURS);
                    setSourceNote('Preview listings with Spotify artist search');
                } else {
                    setTours(incoming);
                    setSourceNote('District live listings with Spotify artist discovery');
                }
            } catch {
                if (!mounted) return;
                setTours(FALLBACK_TOURS);
                setSourceNote('Preview listings with Spotify artist search');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadTours();
        return () => {
            mounted = false;
        };
    }, []);

    const cities = useMemo(
        () => ['All Cities', ...Array.from(new Set(tours.map((tour) => tour.city))).sort((a, b) => a.localeCompare(b))],
        [tours]
    );

    const enrichedTours = useMemo(
        () =>
            tours
                .slice()
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((tour) => ({
                    ...tour,
                    artist: extractArtist(tour.eventName),
                })),
        [tours]
    );

    const filteredTours = useMemo(() => {
        const term = search.trim().toLowerCase();
        return enrichedTours.filter((tour) => {
            const byCity = activeCity === 'All Cities' || tour.city === activeCity;
            if (!byCity) return false;
            if (!term) return true;

            const haystack = [tour.eventName, tour.artist, tour.city, tour.country, tour.venue].join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }, [enrichedTours, activeCity, search]);

    const featured = filteredTours[0] || enrichedTours[0] || null;
    const cityCounts = useMemo(
        () =>
            cities
                .filter((city) => city !== 'All Cities')
                .map((city) => ({
                    city,
                    count: enrichedTours.filter((tour) => tour.city === city).length,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 4),
        [cities, enrichedTours]
    );

    return (
        <div className="relative overflow-hidden">
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(54%_54%_at_75%_8%,rgba(30,215,96,0.14),transparent_66%),radial-gradient(42%_42%_at_18%_16%,rgba(244,162,97,0.12),transparent_62%)]"
            />

            <div className="relative max-w-[1280px] mx-auto px-6 md:px-12 pt-28 pb-16">
                <motion.section
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="grid grid-cols-12 gap-6 items-stretch"
                >
                    <div className="col-span-12 lg:col-span-7 rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-6 md:p-8">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                Spotify radar
                            </span>
                            <span className="text-xs uppercase tracking-[0.14em] text-text-4">{sourceNote}</span>
                        </div>
                        <h1 className="mt-6 font-heading text-[3rem] font-bold leading-[0.94] text-text-1 md:text-[4.8rem]">
                            Find the show. Check the artist. Move fast.
                        </h1>
                        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-text-3 md:text-base">
                            Live listings stay tied to ticket sources, while every artist gets a direct Spotify search so
                            you can listen before committing to the night.
                        </p>

                        <div className="mt-8 grid grid-cols-3 gap-3">
                            <div className="rounded-[0.9rem] bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-text-4">Shows</p>
                                <p className="mt-2 font-heading text-3xl font-bold text-text-1">{filteredTours.length}</p>
                            </div>
                            <div className="rounded-[0.9rem] bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-text-4">Cities</p>
                                <p className="mt-2 font-heading text-3xl font-bold text-text-1">{cities.length - 1}</p>
                            </div>
                            <div className="rounded-[0.9rem] bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-text-4">Source</p>
                                <p className="mt-2 font-heading text-3xl font-bold text-emerald-200">Live</p>
                            </div>
                        </div>
                    </div>

                    <aside className="col-span-12 lg:col-span-5 rounded-[1.2rem] border border-white/10 bg-black/25 p-5">
                        <p className="label-xs mb-4">Tonight's first pull</p>
                        {featured ? (
                            <div className={`rounded-[1rem] bg-gradient-to-br ${cityTone(1)} p-5`}>
                                <p className="font-heading text-3xl font-bold leading-tight text-text-1">
                                    {featured.eventName}
                                </p>
                                <p className="mt-3 text-sm text-text-2">
                                    {featured.venue ? `${featured.venue} - ` : ''}
                                    {featured.city}
                                </p>
                                <div className="mt-5 flex items-end justify-between gap-4">
                                    <div>
                                        <p className="font-heading text-5xl font-bold leading-none text-emerald-200">
                                            {dayFormatter.format(new Date(featured.date))}
                                        </p>
                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-4">
                                            {monthFormatter.format(new Date(featured.date))}
                                        </p>
                                    </div>
                                    <a
                                        href={spotifySearchUrl(featured.artist)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100 transition-colors hover:bg-emerald-500/15"
                                    >
                                        Spotify
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[1rem] bg-white/[0.03] p-5 text-sm text-text-3">No shows loaded yet.</div>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {cityCounts.map((item, index) => (
                                <button
                                    key={item.city}
                                    type="button"
                                    onClick={() => setActiveCity(item.city)}
                                    className={`rounded-[0.85rem] bg-gradient-to-br ${cityTone(index)} p-4 text-left transition-transform hover:-translate-y-0.5`}
                                >
                                    <p className="text-xs uppercase tracking-[0.16em] text-text-4">{item.city}</p>
                                    <p className="mt-2 font-heading text-2xl font-bold text-text-1">{item.count} shows</p>
                                </button>
                            ))}
                        </div>
                    </aside>
                </motion.section>

                <section className="mt-8 rounded-[1rem] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search artist, city, venue, or show"
                            className="h-12 w-full rounded-[0.85rem] border border-white/10 bg-black/20 px-4 text-sm text-text-1 outline-none transition-colors placeholder:text-text-4 focus:border-emerald-400/35 md:flex-1"
                        />
                        <div className="flex gap-2 overflow-x-auto pb-1 md:max-w-[52%]">
                            {cities.map((city) => {
                                const active = city === activeCity;
                                return (
                                    <button
                                        key={city}
                                        type="button"
                                        onClick={() => setActiveCity(city)}
                                        className={`shrink-0 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.11em] transition-colors ${
                                            active
                                                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                                                : 'border-white/10 bg-white/[0.02] text-text-3 hover:text-text-1'
                                        }`}
                                    >
                                        {city}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {loading ? (
                    <div className="mt-6 grid grid-cols-1 gap-3">
                        {[...Array(5)].map((_, index) => (
                            <div key={index} className="h-[118px] animate-pulse rounded-[1rem] bg-white/[0.04]" />
                        ))}
                    </div>
                ) : filteredTours.length === 0 ? (
                    <div className="mt-6 rounded-[1rem] border border-white/10 bg-white/[0.035] p-10 text-center">
                        <p className="font-heading text-2xl font-semibold text-text-1">No shows match this filter.</p>
                        <p className="mt-3 text-sm text-text-3">Try another city or clear the search term.</p>
                    </div>
                ) : (
                    <div className="mt-6 grid grid-cols-1 gap-3">
                        {filteredTours.map((tour, index) => (
                            <motion.div
                                key={tour._id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: index * 0.025 }}
                            >
                                <SpotlightCard className="px-4 py-4 md:px-5" spotlightColor="rgba(30, 215, 96, 0.18)">
                                    <article className="grid grid-cols-12 items-center gap-4">
                                        <div className="col-span-3 sm:col-span-2 lg:col-span-1">
                                            <div className="flex aspect-square min-h-16 flex-col items-center justify-center rounded-[0.85rem] border border-white/10 bg-black/25">
                                                <p className="font-heading text-3xl font-bold leading-none text-text-1">
                                                    {dayFormatter.format(new Date(tour.date))}
                                                </p>
                                                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-text-4">
                                                    {monthFormatter.format(new Date(tour.date))}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="col-span-9 sm:col-span-6 lg:col-span-7">
                                            <p className="font-heading text-2xl font-semibold leading-tight text-text-1">
                                                {tour.eventName}
                                            </p>
                                            <p className="mt-1 text-sm text-text-2">
                                                {tour.venue ? `${tour.venue} - ` : ''}
                                                {tour.city}, {tour.country}
                                            </p>
                                            <p className="mt-2 text-xs text-text-4">
                                                {fullDateFormatter.format(new Date(tour.date))} at {timeFormatter.format(new Date(tour.date))}
                                            </p>
                                        </div>

                                        <div className="col-span-12 flex flex-wrap items-center gap-2 sm:col-span-4 lg:col-span-4 lg:justify-end">
                                            <a
                                                href={spotifySearchUrl(tour.artist)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex h-10 items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 text-xs font-semibold uppercase tracking-[0.11em] text-emerald-100 transition-colors hover:bg-emerald-500/15"
                                            >
                                                Open Spotify
                                            </a>
                                            {tour.ticketsAvailable ? (
                                                <a
                                                    href={tour.ticketUrl || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn-primary h-10 rounded-full px-4 py-0"
                                                >
                                                    Tickets
                                                </a>
                                            ) : (
                                                <span className="inline-flex h-10 items-center rounded-full border border-white/12 bg-white/[0.02] px-4 text-xs text-text-3">
                                                    Sold Out
                                                </span>
                                            )}
                                        </div>
                                    </article>
                                </SpotlightCard>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
