import type { Request, Response, NextFunction } from 'express';
import Era from '../models/Era';
import Thread from '../models/Thread';
import { originFrom } from './crawlerMeta';

// Dynamic sitemap + robots.txt. Served from the function (see vercel.json
// rewrites) rather than as static files because both need the deployment's
// absolute origin — the robots Sitemap directive must be a full URL, and we
// never hardcode a domain anywhere in the repo.

// Indexable static pages. /game and unknown paths redirect to /, and the
// login/register/profile pages are deliberately kept out of the index.
const STATIC_PATHS = ['/', '/archive', '/tours', '/leaderboard'];

// Newest-first cap keeps the response snappy; well under the 50k spec limit.
const THREAD_LIMIT = 5000;

function xmlEscape(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function urlEntry(loc: string, lastmod?: Date): string {
    const lastmodTag = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
    return `<url><loc>${xmlEscape(loc)}</loc>${lastmodTag}</url>`;
}

export async function sitemap(req: Request, res: Response, next: NextFunction) {
    try {
        const origin = originFrom(req);
        const [eras, threads] = await Promise.all([
            Era.find().select('slug').lean(),
            Thread.find({ isDeleted: false })
                .sort({ createdAt: -1 })
                .limit(THREAD_LIMIT)
                .select('_id updatedAt')
                .lean(),
        ]);

        const entries = [
            ...STATIC_PATHS.map((path) => urlEntry(`${origin}${path}`)),
            ...eras.map((era) => urlEntry(`${origin}/era/${encodeURIComponent(era.slug)}`)),
            ...threads.map((thread) => urlEntry(`${origin}/thread/${thread._id}`, thread.updatedAt)),
        ];

        res.set('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
        res.type('application/xml').send(
            `<?xml version="1.0" encoding="UTF-8"?>\n`
            + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
            + entries.join('\n')
            + `\n</urlset>`,
        );
    } catch (err) {
        next(err);
    }
}

export function robots(req: Request, res: Response) {
    const origin = originFrom(req);
    res.set('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.type('text/plain').send(
        `User-agent: *\n`
        + `Allow: /\n`
        + `Disallow: /api/\n`
        + `\n`
        + `Sitemap: ${origin}/sitemap.xml\n`,
    );
}
