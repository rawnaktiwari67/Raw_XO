import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { tourService } from '../services/tourService';
import type { Tour } from '../types/tour';
import SpotlightCard from '../components/ui/SpotlightCard';

const FALLBACK_TOURS: Tour[] = [
    {
        _id: 'fallback-1',
        eventName: 'Mumbai Stadium Night',
        city: 'Mumbai',
        country: 'India',
        venue: 'MMRDA Grounds',
        date: '2026-05-14T19:30:00.000Z',
        ticketsAvailable: true,
        ticketUrl: 'https://www.district.in/activities/music-in-mumbai',
        isActive: true,
    },
    {
        _id: 'fallback-2',
        eventName: 'Delhi Late Set',
        city: 'Delhi/NCR',
        country: 'India',
        venue: 'Jawaharlal Nehru Stadium',
        date: '2026-05-23T20:00:00.000Z',
        ticketsAvailable: true,
        ticketUrl: 'https://www.district.in/activities/music-in-delhi',
        isActive: true,
    },
    {
        _id: 'fallback-3',
        eventName: 'Bengaluru Open Air',
        city: 'Bengaluru',
        country: 'India',
        venue: 'Venue to be announced',
        date: '2026-06-01T19:30:00.000Z',
        ticketsAvailable: true,
        ticketUrl: 'https://www.district.in/activities/music-in-bengaluru',
        isActive: true,
    },
];

const dayFormatter = new Intl.DateTimeFormat('en-US', { day: '2-digit' });
const monthYearFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

export default function Tours() {
    const [tours, setTours] = useState<Tour[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeCity, setActiveCity] = useState('All Cities');
    const [sourceNote, setSourceNote] = useState('District India live schedule');

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
                    setSourceNote('India preview schedule');
                } else {
                    setTours(incoming);
                    setSourceNote('District India live schedule');
                }
            } catch {
                if (!mounted) return;
                setTours(FALLBACK_TOURS);
                setSourceNote('India preview schedule');
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

    const filteredTours = useMemo(() => {
        const term = search.trim().toLowerCase();
        return tours.filter((tour) => {
            const byCity = activeCity === 'All Cities' || tour.city === activeCity;
            if (!byCity) return false;
            if (!term) return true;

            const haystack = [tour.eventName, tour.city, tour.country, tour.venue].join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }, [tours, activeCity, search]);

    return (
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 pt-28 pb-14">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="grid grid-cols-12 gap-8 items-end mb-10">
                    <div className="col-span-12 md:col-span-7">
                        <p className="label-xs mb-4">Tour Calendar</p>
                        <h1 className="display-lg">India concert dates, city by city.</h1>
                    </div>
                    <div className="col-span-12 md:col-span-5">
                        <p className="text-text-3 text-sm leading-relaxed">
                            Pulling live music listings for major Indian cities, then letting you lock in the nearest
                            night fast.
                        </p>
                        <p className="text-text-4 text-xs mt-4">{sourceNote}</p>
                    </div>
                </div>

                <div className="glass-surface p-5 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search city, venue, or show"
                            className="w-full md:flex-1 bg-ch-1 border border-white/10 rounded-lg px-4 py-3 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:border-white/25"
                        />
                        <div className="text-xs text-text-4 md:text-right md:min-w-[140px]">
                            {loading ? 'Loading schedule' : `${filteredTours.length} shows`}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                        {cities.map((city) => {
                            const active = city === activeCity;
                            return (
                                <button
                                    key={city}
                                    onClick={() => setActiveCity(city)}
                                    className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                                        active
                                            ? 'bg-amber-dim border-amber/40 text-amber'
                                            : 'bg-white/[0.02] border-white/10 text-text-3 hover:text-text-1'
                                    }`}
                                >
                                    {city}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[...Array(5)].map((_, index) => (
                            <div key={index} className="glass-surface h-[98px] animate-pulse" />
                        ))}
                    </div>
                ) : filteredTours.length === 0 ? (
                    <div className="glass-surface p-10 text-center">
                        <p className="font-heading font-semibold text-text-1 text-xl tracking-tight">
                            No shows match this filter.
                        </p>
                        <p className="text-text-3 text-sm mt-3">Try another city or clear the search term.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredTours
                            .slice()
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map((tour, index) => (
                                <motion.div
                                    key={tour._id}
                                    initial={{ opacity: 0, y: 14 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: index * 0.04 }}
                                >
                                    <SpotlightCard className="px-5 py-4" spotlightColor="rgba(244, 162, 97, 0.22)">
                                        <article className="grid grid-cols-12 gap-4 items-center">
                                            <div className="col-span-12 sm:col-span-2">
                                                <p className="font-heading font-bold text-3xl text-accent leading-none tracking-tight">
                                                    {dayFormatter.format(new Date(tour.date))}
                                                </p>
                                                <p className="text-text-4 text-xs uppercase mt-1">
                                                    {monthYearFormatter.format(new Date(tour.date))}
                                                </p>
                                            </div>

                                            <div className="col-span-12 sm:col-span-7">
                                                <p className="font-heading font-semibold text-text-1 text-xl tracking-tight">
                                                    {tour.eventName}
                                                </p>
                                                <p className="text-text-2 text-sm mt-1">
                                                    {tour.venue ? `${tour.venue} - ` : ''}
                                                    {tour.city}, {tour.country}
                                                </p>
                                                <p className="text-text-4 text-xs mt-2">
                                                    {fullDateFormatter.format(new Date(tour.date))}
                                                </p>
                                            </div>

                                            <div className="col-span-12 sm:col-span-3 sm:text-right">
                                                {tour.ticketsAvailable ? (
                                                    <a
                                                        href={tour.ticketUrl || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-primary rounded-lg inline-flex"
                                                    >
                                                        Get Tickets
                                                    </a>
                                                ) : (
                                                    <span className="inline-flex px-4 py-2 rounded-lg text-xs border border-white/12 text-text-3 bg-white/[0.02]">
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
            </motion.div>
        </div>
    );
}
