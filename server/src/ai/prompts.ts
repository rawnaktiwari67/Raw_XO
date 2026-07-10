import type { SongPreview } from '../utils/songTokens';
import type { ChatMessage } from './groqClient';
import type { RetrievedChunk } from './vectorStore';

// Prompt templates for both AI routes, plus the hint-leak redaction filter.
// Everything that shapes what the model is ALLOWED to say lives in this file.

// ─── Trivia (RAG) ─────────────────────────────────────────────────────────────

export const TRIVIA_FALLBACK = "I don't have info on that.";

/**
 * Grounded-answer template: the model may only use the numbered context entries
 * retrieved from the vector store. Putting the context in the system message
 * (not the user turn) matters — instructions in the user turn are easier to
 * override with "ignore the above" style prompts.
 */
export const buildTriviaMessages = (question: string, chunks: RetrievedChunk[]): ChatMessage[] => {
    const context = chunks
        .map((chunk, index) => `[${index + 1}] (${chunk.source}) ${chunk.text}`)
        .join('\n');

    return [
        {
            role: 'system',
            content: [
                'You are XO Oracle, the music trivia assistant for Raw XO, a music guessing-game and fan-culture app.',
                'Answer the user\'s question using ONLY the context entries below. Treat the context as your entire knowledge.',
                `If the context does not contain the answer, reply exactly: "${TRIVIA_FALLBACK}" — no apologies, no guessing, no outside knowledge.`,
                'Keep answers to 1-3 sentences, conversational, and cite nothing but facts present in the context.',
                '',
                'Context:',
                context || '(no relevant context was found)',
            ].join('\n'),
        },
        { role: 'user', content: question },
    ];
};

// ─── Hints ────────────────────────────────────────────────────────────────────

/**
 * Specificity ladder: hints get more concrete as the player burns guesses.
 *   guesses 1-2 → vague and atmospheric (mood, imagery — no identifying facts)
 *   guesses 3-4 → concrete but not unique (genre, era, career context)
 *   guesses 5+  → near-giveaway (album, year, chart facts, lyric themes)
 */
const hintTierInstruction = (guessesUsed: number): string => {
    if (guessesUsed <= 2) {
        return 'Give a VAGUE, atmospheric hint: the mood, energy, or imagery of the song. No genre, no era, no facts that narrow it down.';
    }
    if (guessesUsed <= 4) {
        return 'Give a MODERATELY specific hint: genre, release era, or where it sits in the artist\'s career. Still no album names or chart positions.';
    }
    return 'Give a NEAR-GIVEAWAY hint: you may reference the album, release year, chart performance, or what the lyrics are about.';
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
            'You write one-sentence hints for a song guessing game. The player is listening to a short clip and must name the track.',
            hintTierInstruction(guessesUsed),
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
            `Popularity (0-100): ${song.popularity >= 0 ? song.popularity : 'unknown'}`,
            '',
            `The player has used ${guessesUsed} guess${guessesUsed === 1 ? '' : 'es'}. Write the hint.`,
        ].join('\n'),
    },
];

// Strip iTunes/Spotify suffixes like "(feat. X)", "- Remastered 2011" so the
// core title is what gets redacted, then escape for use in a RegExp.
const coreTitle = (title: string): string =>
    title.replace(/\s*[([-].*$/, '').trim() || title;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Deterministic backstop for the prompt guardrail: even if the model ignores
 * its instructions, the title and artist strings never reach the client. Each
 * leaked occurrence is replaced with a redaction marker rather than silently
 * deleted, so a slipped hint reads as obviously censored instead of subtly
 * wrong. Prompt rules are probabilistic; this filter is not.
 */
export const redactHintLeaks = (hint: string, song: SongPreview): string => {
    const secrets = [
        coreTitle(song.title),
        song.title,
        // Multi-artist strings arrive joined ("The Weeknd, Daft Punk") — redact
        // each artist individually too.
        ...song.artist.split(',').map((name) => name.trim()),
    ].filter((secret) => secret.length >= 3);

    return secrets.reduce(
        (result, secret) => result.replace(new RegExp(escapeRegExp(secret), 'gi'), '████'),
        hint
    );
};
