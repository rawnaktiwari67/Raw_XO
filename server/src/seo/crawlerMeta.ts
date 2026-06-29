import type { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Thread from '../models/Thread';
import Era from '../models/Era';

// Server-side Open Graph for deep links. Social scrapers (WhatsApp, Twitter,
// Slack, Discord, iMessage, etc.) don't run JavaScript, so the SPA's client-side
// meta tags never reach them. On Vercel these crawler requests are rewritten to
// the serverless function (see vercel.json) only when the User-Agent matches a
// known bot — real users keep the static, client-rendered path untouched.

const SITE_NAME = 'Raw XO';
const DEFAULT_TITLE = 'Raw XO — Five seconds. Four options. One instinct.';
const DEFAULT_DESCRIPTION =
    'A cinematic 5-second music guessing game and culture room. Guess fast, climb the leaderboard, argue about what the lyrics mean.';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncate(value: string, max = 160): string {
    const clean = value.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// Build an absolute origin from the proxied request headers so we never hardcode
// a domain — the function serves whatever host it was reached on.
function originFrom(req: Request): string {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    return `${proto.split(',')[0]}://${host}`;
}

interface Meta {
    title: string;
    description: string;
}

async function resolveMeta(path: string): Promise<Meta> {
    const profile = path.match(/^\/profile\/([^/?#]+)/);
    if (profile) {
        const username = decodeURIComponent(profile[1]);
        const user = await User.findOne({ username }).select('username bio').lean();
        if (user) {
            return {
                title: `${user.username} — ${SITE_NAME}`,
                description: user.bio
                    ? truncate(user.bio)
                    : `${user.username}'s profile on Raw XO — streaks, ratings, levels, and recent rounds.`,
            };
        }
    }

    const thread = path.match(/^\/thread\/([^/?#]+)/);
    if (thread) {
        const doc = await Thread.findById(thread[1]).select('title body isDeleted').lean();
        if (doc && !doc.isDeleted) {
            return {
                title: `${doc.title} — ${SITE_NAME}`,
                description: truncate(doc.body || DEFAULT_DESCRIPTION),
            };
        }
    }

    const era = path.match(/^\/era\/([^/?#]+)/);
    if (era) {
        const slug = decodeURIComponent(era[1]);
        const doc = await Era.findOne({ slug }).select('name description').lean();
        if (doc) {
            return {
                title: `${doc.name} — ${SITE_NAME}`,
                description: truncate(doc.description || DEFAULT_DESCRIPTION),
            };
        }
    }

    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
}

function renderShell(meta: Meta, origin: string, url: string): string {
    const title = escapeHtml(meta.title);
    const description = escapeHtml(meta.description);
    const image = `${origin}/og-cover.png`;
    const canonical = escapeHtml(url);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
<p><a href="${canonical}">Open Raw XO</a></p>
</body>
</html>`;
}

export async function crawlerMeta(req: Request, res: Response, next: NextFunction) {
    try {
        const origin = originFrom(req);
        const url = `${origin}${req.originalUrl}`;
        const meta = await resolveMeta(req.path);
        res.status(200).type('html').send(renderShell(meta, origin, url));
    } catch (err) {
        next(err);
    }
}
