import { describe, expect, it } from 'vitest';
import { redactHintLeaks } from './prompts';
import type { SongPreview } from '../utils/songTokens';

const song = (overrides: Partial<SongPreview>): SongPreview => ({
    id: '1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    releaseYear: 2019,
    durationMs: 200040,
    snippetUrl: '',
    artworkUrl: '',
    trackUrl: '',
    popularity: 96,
    ...overrides,
});

describe('redactHintLeaks', () => {
    it('redacts the full title phrase', () => {
        expect(redactHintLeaks('This one is Blinding Lights obviously.', song({})))
            .not.toContain('Blinding Lights');
    });

    it('redacts individual distinctive title words, not just the full phrase', () => {
        const result = redactHintLeaks('The lights blind you on this synthwave hit.', song({}));
        expect(result).not.toMatch(/lights/i);
        // "blind" is not a title word ("Blinding" is) — word-boundary match must not maim it.
        expect(result).toContain('blind');
    });

    it('redacts each artist in a joined multi-artist billing', () => {
        const result = redactHintLeaks(
            'Tyla and Travis Scott made this one.',
            song({ title: 'Water (Remix)', artist: 'Tyla & Travis Scott' })
        );
        expect(result).not.toMatch(/tyla|travis|scott/i);
    });

    it('does not censor unrelated words that merely contain a secret word', () => {
        const result = redactHintLeaks(
            'A Scottish-sounding synth line drives it.',
            song({ artist: 'Travis Scott' })
        );
        expect(result).toContain('Scottish');
    });

    it('leaves common stopwords alone even when they appear in the title', () => {
        const result = redactHintLeaks(
            'The song that starts this album.',
            song({ title: 'This Is The Remix', artist: 'Somebody' })
        );
        expect(result).toContain('that');
        expect(result).toContain('The');
    });

    it('strips version suffixes so the core title is what gets caught', () => {
        const result = redactHintLeaks(
            'Think water, hydration, a splash.',
            song({ title: 'Water (Remix)', artist: 'Tyla' })
        );
        expect(result).not.toMatch(/\bwater\b/i);
    });
});
