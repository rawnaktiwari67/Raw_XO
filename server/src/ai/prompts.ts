import type { SongPreview } from '../utils/songTokens';
import type { ChatMessage } from './groqClient';

// Prompt templates for the AI hint route, plus the hint-leak redaction filter.
// Everything that shapes what the model is ALLOWED to say lives in this file.

/**
 * Specificity ladder: hints get more concrete as the player buys more.
 *   guesses 1-2 → the song's subject: what it's about, its story or image
 *   guesses 3-4 → context: sound, release window, place in the artist's run
 *   guesses 5+  → near-giveaway (album, year, chart facts, famous moments)
 * Every tier must still discriminate — a hint that fits all four options is
 * a 15-point refund request waiting to happen.
 */
const hintTierInstruction = (guessesUsed: number): string => {
    if (guessesUsed <= 2) {
        return 'FIRST HINT — the subject: say what this song is about (its story, scenario, or central image) so a fan could match it to the right title. No album, year, or career facts yet.';
    }
    if (guessesUsed <= 4) {
        return 'SECOND HINT — the context: place the song. Its sound or production signature, the release window, a collaboration detail, or where it sits in the artist\'s run. Still no album names or chart positions.';
    }
    return 'FINAL HINT — near-giveaway: be maximally helpful. Album, release year, a chart or cultural moment, the music video\'s imagery, or a close paraphrase of its most famous line.';
};

/**
 * THE GUARDRAIL: at every tier — including near-giveaway — the model is
 * forbidden from stating the title or artist, and from the classic side
 * channels players use to extract them (initials, rhymes, blank-outs, letter
 * counts, "sounds like"). The hint must make a fan go "oh, I know this one",
 * never hand over the answer string. redactHintLeaks() below backstops this
 * deterministically in case the model slips anyway.
 */
export const buildHintMessages = (song: SongPreview, guessesUsed: number): ChatMessage[] => [
    {
        role: 'system',
        content: [
            'You write one-sentence hints for a song guessing game. The player hears a short clip and must pick the correct track title from FOUR title options — several may be by the same artist. Your hint is only worth its cost if it helps eliminate the wrong titles, so it must point at what makes THIS song different from the artist\'s other songs.',
            hintTierInstruction(guessesUsed),
            '',
            'Quality rules:',
            '- The best hint gestures at the title\'s meaning without its words: for a song titled after rainfall, talk about storms and what falls from the sky.',
            '- NEVER write generic mood filler ("dark and atmospheric", "a haunting soundscape", "melancholic reflection") — that describes a thousand songs and helps no one. Every hint needs at least one concrete detail specific to this song.',
            '- Be honest about what you know: if you recognize this exact song, use one real, specific fact (its subject, a lyric\'s theme, a video moment, a sample). If you do NOT recognize it, build the hint only from the metadata provided — never invent lyrics, chart positions, or trivia.',
            '',
            'Hard rules, no exceptions at any specificity level:',
            '- NEVER say the song title or any word from it.',
            '- NEVER say the artist\'s name, nicknames, or band members\' names.',
            '- NEVER hint at either via initials, rhymes, spelling, letter counts, fill-in-the-blanks, or "sounds like" wordplay.',
            '- One sentence, max 30 words. No preamble like "Here\'s your hint".',
        ].join('\n'),
    },
    {
        role: 'user',
        content: [
            'Song metadata (for your eyes only — never quote identifying strings from it):',
            `Title: ${song.title}`,
            `Artist: ${song.artist}`,
            `Album: ${song.album || 'unknown'}`,
            `Release year: ${song.releaseYear || 'unknown'}`,
            `Length: ${song.durationMs > 0 ? `${Math.floor(song.durationMs / 60000)}:${String(Math.floor((song.durationMs % 60000) / 1000)).padStart(2, '0')}` : 'unknown'}`,
            `Popularity (0-100): ${song.popularity >= 0 ? song.popularity : 'unknown'}`,
            '',
            `This is hint number ${Math.min(3, Math.ceil(guessesUsed / 2))} for this round. Write it.`,
        ].join('\n'),
    },
];

// Strip iTunes/Spotify suffixes like "(feat. X)", "- Remastered 2011" so the
// core title is what gets redacted, then escape for use in a RegExp.
const coreTitle = (title: string): string =>
    title.replace(/\s*[([-].*$/, '').trim() || title;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Words that show up in half of all song titles and artist billings — redacting
// them from a hint would cripple normal prose without protecting anything.
const REDACTION_STOPWORDS = new Set([
    'the', 'and', 'with', 'from', 'that', 'this', 'your', 'feat', 'featuring',
    'remix', 'version', 'edit', 'deluxe', 'live', 'remastered', 'interlude',
]);

/**
 * Deterministic backstop for the prompt guardrail: even if the model ignores
 * its instructions, the title and artist strings never reach the client. Full
 * phrases AND individual distinctive words are redacted — "Lights" gives away
 * "Blinding Lights" just as surely as the full title does. Each leak is
 * replaced with a redaction marker rather than silently deleted, so a slipped
 * hint reads as obviously censored instead of subtly wrong. Prompt rules are
 * probabilistic; this filter is not.
 */
export const redactHintLeaks = (hint: string, song: SongPreview): string => {
    // Multi-artist strings arrive joined ("The Weeknd, Daft Punk",
    // "Tyla & Travis Scott") — split so each artist is redacted individually.
    const artists = song.artist.split(/[,&]/).map((name) => name.trim());
    const phrases = [coreTitle(song.title), song.title, ...artists]
        .filter((phrase) => phrase.length >= 3);

    const words = [...new Set(
        phrases
            .flatMap((phrase) => phrase.split(/[^\p{L}\p{N}]+/u))
            .filter((word) => word.length >= 4 && !REDACTION_STOPWORDS.has(word.toLowerCase()))
    )];

    const phrasePass = phrases.reduce(
        (result, phrase) => result.replace(new RegExp(escapeRegExp(phrase), 'gi'), '████'),
        hint
    );
    // Words get \b anchors so "Scott" doesn't censor the middle of "Scottish".
    return words.reduce(
        (result, word) => result.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi'), '████'),
        phrasePass
    );
};
