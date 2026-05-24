/**
 * Afterglow FM - Database Seed Script
 * Run: npm run seed
 * Seeds: 6 Album Eras + sample tour dates
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Era from '../models/Era';
import Tour from '../models/Tour';

const ERAS = [
    { slug: 'house-of-balloons', name: 'House of Balloons', year: 2011, order: 1, accentColor: '#B388FF', description: 'The raw, unfiltered debut mixtape that introduced The Weeknd to the world. Dark, atmospheric R&B steeped in late-night Toronto energy.', coverImage: '' },
    { slug: 'kiss-land', name: 'Kiss Land', year: 2013, order: 2, accentColor: '#F06292', description: 'A cinematic, fever-dream studio album depicting the disorientation of sudden global fame. Lush production, shadowy themes.', coverImage: '' },
    { slug: 'beauty-behind-the-madness', name: 'Beauty Behind the Madness', year: 2015, order: 3, accentColor: '#FF7A3D', description: 'The breakthrough major-label debut. Chart-topping pop polish wrapped around themes of excess and emotional detachment.', coverImage: '' },
    { slug: 'starboy', name: 'Starboy', year: 2016, order: 4, accentColor: '#F2C078', description: 'Daft Punk-infused synth-pop with introspection beneath its glossy surface. A statement of identity and celebrity critique.', coverImage: '' },
    { slug: 'after-hours', name: 'After Hours', year: 2020, order: 5, accentColor: '#EF5350', description: 'A cinematic noir concept album. The signature red-suit era, exploring self-destruction, paranoia, and obsession.', coverImage: '' },
    { slug: 'dawn-fm', name: 'Dawn FM', year: 2022, order: 6, accentColor: '#4FC3F7', description: 'An 80s-inspired synth-pop journey through purgatory, narrated as a radio station. Introspective, euphoric, and nostalgic.', coverImage: '' },
];

const TOURS = [
    { eventName: 'After Hours Til Dawn Tour', city: 'Los Angeles', country: 'USA', venue: 'SoFi Stadium', date: new Date('2026-08-10'), ticketsAvailable: true, ticketUrl: 'https://ticketmaster.com' },
    { eventName: 'After Hours Til Dawn Tour', city: 'New York', country: 'USA', venue: 'MetLife Stadium', date: new Date('2026-08-18'), ticketsAvailable: true, ticketUrl: 'https://ticketmaster.com' },
    { eventName: 'After Hours Til Dawn Tour', city: 'Toronto', country: 'Canada', venue: 'Rogers Centre', date: new Date('2026-09-02'), ticketsAvailable: false, ticketUrl: '' },
    { eventName: 'After Hours Til Dawn Tour', city: 'London', country: 'UK', venue: 'Wembley Stadium', date: new Date('2026-09-20'), ticketsAvailable: true, ticketUrl: 'https://ticketmaster.co.uk' },
    { eventName: 'After Hours Til Dawn Tour', city: 'Paris', country: 'France', venue: 'Stade de France', date: new Date('2026-09-28'), ticketsAvailable: false, ticketUrl: '' },
    { eventName: 'After Hours Til Dawn Tour', city: 'Dubai', country: 'UAE', venue: 'Expo City Arena', date: new Date('2026-10-15'), ticketsAvailable: true, ticketUrl: 'https://ticketmaster.ae' },
];

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected to MongoDB');

        await Era.deleteMany({});
        await Tour.deleteMany({});

        await Era.insertMany(ERAS);
        console.log(`✅ Seeded ${ERAS.length} eras`);

        await Tour.insertMany(TOURS);
        console.log(`✅ Seeded ${TOURS.length} tours`);

        console.log('🎉 Seed complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    }
};

seed();
