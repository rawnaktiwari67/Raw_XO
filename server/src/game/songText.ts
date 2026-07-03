// Pure text-normalization and matching helpers for song titles and artist
// names. Used to dedupe queries, match a guess against the correct track, keep
// distractors from colliding, and detect alternate (live/remaster/etc.) cuts.

export const normalizeTitle = (value: string): string =>
    value.toLowerCase().trim().replace(/\s+/g, ' ');

export const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeArtistKey = (value: string): string =>
    normalizeTitle(value)
        .replace(/\s*(feat\.?|ft\.?|featuring)\s+.+$/i, '')
        .replace(/[^\p{L}\p{N}\s&]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const normalizeTrackTitleKey = (value: string): string =>
    normalizeTitle(value)
        .replace(/\s*(feat\.?|ft\.?|featuring)\s+.+$/i, '')
        .replace(/\s*[\(\[]\s*(feat\.?|ft\.?|featuring)\s+.*?[\)\]]/gi, '')
        .replace(/\s*[\(\[].*?(remaster|live|acoustic|version|edit|mix|mono|stereo|deluxe).*?[\)\]]/gi, '')
        .replace(/\s+-\s*(remaster|live|acoustic|version|edit|mix|feat\.?|ft\.?|featuring).*/gi, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const artistTokens = (value: string): string[] =>
    normalizeArtistKey(value)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && token !== 'the');

export const titleTokens = (value: string): string[] =>
    normalizeTrackTitleKey(value)
        .split(' ')
        .filter((token) => token.length >= 3);

export const isAlternateTrackVersion = (value: string): boolean =>
    /\b(live|remaster(?:ed)?|acoustic|version|edit|mix|karaoke|instrumental|sped up|slowed|nightcore)\b/i.test(value);

export const isLikelySameArtist = (requestedArtist: string, candidateArtist: string): boolean => {
    const requestedTokens = artistTokens(requestedArtist);
    if (requestedTokens.length === 0) return true;

    const candidateTokens = artistTokens(candidateArtist);
    if (candidateTokens.length === 0) return false;

    return requestedTokens.every((requestedToken) =>
        candidateTokens.some(
            (candidateToken) =>
                candidateToken === requestedToken ||
                candidateToken.startsWith(requestedToken) ||
                requestedToken.startsWith(candidateToken)
        )
    );
};
