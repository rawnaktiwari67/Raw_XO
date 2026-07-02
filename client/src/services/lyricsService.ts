import api from './api';
import type { MeaningEntry, NormalizedMusicItem } from '../types/culture';

type LyricSeed = {
    match: { title: string; artist: string };
    shortTake: string;
    alternateMeanings: string[];
    whyItHits: string;
    whenItDropped: string;
    whatWasHappening: string;
    meanings: Array<{ id: string; label: string; votes: number }>;
    reactions: Array<{ id: string; label: string; count: number }>;
};

const STORAGE_KEY = 'raw-xo-culture-votes';

const LYRIC_LIBRARY: LyricSeed[] = [
    {
        match: { title: 'The Hills', artist: 'The Weeknd' },
        shortTake: 'It is not romance. It is self-destruction with perfect lighting.',
        alternateMeanings: ['desire with a crash built in', 'ego hiding panic', 'fame making intimacy harder'],
        whyItHits: 'The line sounds numb and reckless at the same time.',
        whenItDropped: '2015. Pop got darker and more confessional.',
        whatWasHappening: 'Mystique became part of the character, not just the rollout.',
        meanings: [
            { id: 'heartbreak', label: 'heartbreak', votes: 28 },
            { id: 'ego', label: 'ego', votes: 41 },
            { id: 'regret', label: 'regret', votes: 31 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 214 },
            { id: 'cold', label: 'cold', count: 121 },
            { id: 'painful', label: 'painful', count: 166 },
            { id: 'deep', label: 'deep', count: 147 },
        ],
    },
    {
        match: { title: 'Starboy', artist: 'The Weeknd' },
        shortTake: 'Success sounds bright here, but the flex still feels bruised.',
        alternateMeanings: ['fame with side effects', 'revenge dressed as polish', 'survival as swagger'],
        whyItHits: 'The confidence is real. So is the exhaustion beneath it.',
        whenItDropped: '2016. The villain grin became a pop engine.',
        whatWasHappening: 'He was turning isolation into a stadium-sized identity.',
        meanings: [
            { id: 'fame', label: 'fame', votes: 44 },
            { id: 'ego', label: 'ego', votes: 36 },
            { id: 'regret', label: 'regret', votes: 20 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 198 },
            { id: 'cold', label: 'cold', count: 143 },
            { id: 'painful', label: 'painful', count: 76 },
            { id: 'deep', label: 'deep', count: 118 },
        ],
    },
    {
        match: { title: "Marvins Room", artist: 'Drake' },
        shortTake: 'The song is drunk honesty pretending to be casual.',
        alternateMeanings: ['loneliness dressed as confidence', 'regret after winning', 'need turning into performance'],
        whyItHits: 'He calls late, but the line is really about pride cracking open.',
        whenItDropped: '2011. Sad flex became a real lane.',
        whatWasHappening: 'Confession and status were melting into the same persona.',
        meanings: [
            { id: 'heartbreak', label: 'heartbreak', votes: 52 },
            { id: 'fame', label: 'fame', votes: 17 },
            { id: 'regret', label: 'regret', votes: 31 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 188 },
            { id: 'cold', label: 'cold', count: 92 },
            { id: 'painful', label: 'painful', count: 174 },
            { id: 'deep', label: 'deep', count: 139 },
        ],
    },
    {
        match: { title: 'Runaway', artist: 'Kanye West' },
        shortTake: 'The apology lands hardest because it still protects the ego.',
        alternateMeanings: ['self-awareness without change', 'ego begging for mercy', 'guilt made theatrical'],
        whyItHits: 'It admits the damage while still centering the damaged person.',
        whenItDropped: '2010. The spectacle got brutally self-aware.',
        whatWasHappening: 'Public fallout, exile energy, and maximalist reinvention.',
        meanings: [
            { id: 'ego', label: 'ego', votes: 38 },
            { id: 'regret', label: 'regret', votes: 47 },
            { id: 'fame', label: 'fame', votes: 15 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 231 },
            { id: 'cold', label: 'cold', count: 108 },
            { id: 'painful', label: 'painful', count: 201 },
            { id: 'deep', label: 'deep', count: 190 },
        ],
    },
    {
        match: { title: 'FE!N', artist: 'Travis Scott' },
        shortTake: 'This is obsession turning into a chant.',
        alternateMeanings: ['adrenaline addiction', 'ego as fuel', 'chaos for sport'],
        whyItHits: 'The repetition makes the rush feel involuntary.',
        whenItDropped: '2023. Festival energy got distilled into a single nerve.',
        whatWasHappening: 'The stage persona was overtaking the song structure itself.',
        meanings: [
            { id: 'ego', label: 'ego', votes: 33 },
            { id: 'fame', label: 'fame', votes: 25 },
            { id: 'regret', label: 'regret', votes: 12 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 264 },
            { id: 'cold', label: 'cold', count: 114 },
            { id: 'painful', label: 'painful', count: 42 },
            { id: 'deep', label: 'deep', count: 81 },
        ],
    },
    {
        match: { title: 'Tum Hi Ho', artist: 'Arijit Singh' },
        shortTake: 'Total surrender sounds beautiful until it feels dangerous.',
        alternateMeanings: ['devotion as identity loss', 'romance without boundaries', 'need disguised as worship'],
        whyItHits: 'The line is intimate because it leaves no emotional escape hatch.',
        whenItDropped: '2013. One song turned longing into atmosphere.',
        whatWasHappening: 'Arijit became the voice of vulnerable obsession almost overnight.',
        meanings: [
            { id: 'heartbreak', label: 'heartbreak', votes: 46 },
            { id: 'regret', label: 'regret', votes: 18 },
            { id: 'deep', label: 'devotion', votes: 36 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 207 },
            { id: 'cold', label: 'cold', count: 35 },
            { id: 'painful', label: 'painful', count: 191 },
            { id: 'deep', label: 'deep', count: 224 },
        ],
    },
    {
        match: { title: 'Born to Shine', artist: 'Diljit Dosanjh' },
        shortTake: 'Confidence here is not defense. It is arrival.',
        alternateMeanings: ['earned ego', 'cultural pride on full display', 'victory without apology'],
        whyItHits: 'The line lifts because it sounds like self-belief with witnesses.',
        whenItDropped: '2020. Punjabi confidence got even bigger global speakers.',
        whatWasHappening: 'The crossover was no longer trying to explain itself.',
        meanings: [
            { id: 'ego', label: 'ego', votes: 42 },
            { id: 'fame', label: 'fame', votes: 39 },
            { id: 'regret', label: 'regret', votes: 8 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 173 },
            { id: 'cold', label: 'cold', count: 121 },
            { id: 'painful', label: 'painful', count: 18 },
            { id: 'deep', label: 'deep', count: 74 },
        ],
    },
    {
        match: { title: 'Excuses', artist: 'AP Dhillon' },
        shortTake: 'The distance feels casual until you hear how final it is.',
        alternateMeanings: ['detachment as heartbreak', 'coolness as defense', 'moving on before the wound closes'],
        whyItHits: 'The line sounds smooth, but the ache is in the restraint.',
        whenItDropped: '2020. Bedroom-scale cool turned into a global loop.',
        whatWasHappening: 'Punjabi pop started traveling like late-night text residue.',
        meanings: [
            { id: 'heartbreak', label: 'heartbreak', votes: 41 },
            { id: 'cold', label: 'distance', votes: 32 },
            { id: 'regret', label: 'regret', votes: 27 },
        ],
        reactions: [
            { id: 'hits', label: 'hits', count: 184 },
            { id: 'cold', label: 'cold', count: 162 },
            { id: 'painful', label: 'painful', count: 148 },
            { id: 'deep', label: 'deep', count: 111 },
        ],
    },
];

type PersistedFeedback = {
    meaningVotes: Record<string, Record<string, number>>;
    reactions: Record<string, Record<string, number>>;
};

const readFeedback = (): PersistedFeedback => {
    if (typeof window === 'undefined') {
        return { meaningVotes: {}, reactions: {} };
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { meaningVotes: {}, reactions: {} };
        return JSON.parse(raw) as PersistedFeedback;
    } catch {
        return { meaningVotes: {}, reactions: {} };
    }
};

const writeFeedback = (payload: PersistedFeedback) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const matchSeed = (track: NormalizedMusicItem): LyricSeed | undefined =>
    LYRIC_LIBRARY.find(
        (entry) =>
            track.title.toLowerCase().includes(entry.match.title.toLowerCase()) &&
            track.artist.toLowerCase().includes(entry.match.artist.toLowerCase())
    );

const fallbackEntry = (track: NormalizedMusicItem): MeaningEntry => ({
    ...track,
    shortTake: 'The mood is here. The community meaning has not settled yet.',
    alternateMeanings: ['ego in motion', 'private damage in public light', 'feeling first, clarity later'],
    whyItHits: 'The strongest lines usually say less than the feeling they leave behind.',
    whenItDropped: `${track.releaseYear}. The mood did the heavy lifting.`,
    whatWasHappening: `${track.artist} was in a ${track.artistPhase} phase.`,
    meanings: [
        { id: 'heartbreak', label: 'heartbreak', votes: 25 },
        { id: 'ego', label: 'ego', votes: 34 },
        { id: 'regret', label: 'regret', votes: 21 },
    ],
    reactions: [
        { id: 'hits', label: 'hits', count: 90 },
        { id: 'cold', label: 'cold', count: 42 },
        { id: 'painful', label: 'painful', count: 63 },
        { id: 'deep', label: 'deep', count: 78 },
    ],
});

const applyFeedback = (entry: MeaningEntry): MeaningEntry => {
    const feedback = readFeedback();
    const meaningIncrements = feedback.meaningVotes[entry.trackId] || {};
    const reactionIncrements = feedback.reactions[entry.trackId] || {};

    return {
        ...entry,
        meanings: entry.meanings.map((meaning) => ({
            ...meaning,
            votes: meaning.votes + (meaningIncrements[meaning.id] || 0),
        })),
        reactions: entry.reactions.map((reaction) => ({
            ...reaction,
            count: reaction.count + (reactionIncrements[reaction.id] || 0),
        })),
    };
};

export type TrackSelection = { meaningId?: string; reactionId?: string };
export type MeaningEntriesResult = {
    entries: MeaningEntry[];
    selections: Record<string, TrackSelection>;
};

export const lyricsService = {
    async getMeaningEntries(tracks: NormalizedMusicItem[]): Promise<MeaningEntriesResult> {
        const baseEntries = tracks.map((track) => {
            const seed = matchSeed(track);
            const entry: MeaningEntry = seed
                ? {
                    ...track,
                    shortTake: seed.shortTake,
                    alternateMeanings: seed.alternateMeanings,
                    whyItHits: seed.whyItHits,
                    whenItDropped: seed.whenItDropped,
                    whatWasHappening: seed.whatWasHappening,
                    meanings: seed.meanings.map((meaning) => ({ ...meaning })),
                    reactions: seed.reactions.map((reaction) => ({ ...reaction })),
                }
                : fallbackEntry(track);

            return applyFeedback(entry);
        });

        try {
            const response = await api.get('/culture/signals', {
                params: { trackIds: tracks.map((track) => track.trackId).join(',') },
            });
            const signals = Array.isArray(response.data?.data) ? response.data.data as Array<{
                trackId: string;
                meaningVotes?: Record<string, number>;
                reactions?: Record<string, number>;
                userMeaning?: string | null;
                userReaction?: string | null;
            }> : [];

            const signalMap = new Map(signals.map((signal) => [signal.trackId, signal]));
            const selections: Record<string, TrackSelection> = {};

            const entries = baseEntries.map((entry) => {
                const signal = signalMap.get(entry.trackId);
                if (!signal) return entry;

                if (signal.userMeaning || signal.userReaction) {
                    selections[entry.trackId] = {
                        meaningId: signal.userMeaning || undefined,
                        reactionId: signal.userReaction || undefined,
                    };
                }

                return {
                    ...entry,
                    meanings: entry.meanings.map((meaning) => ({
                        ...meaning,
                        votes: meaning.votes + (signal.meaningVotes?.[meaning.id] || 0),
                    })),
                    reactions: entry.reactions.map((reaction) => ({
                        ...reaction,
                        count: reaction.count + (signal.reactions?.[reaction.id] || 0),
                    })),
                };
            });

            return { entries, selections };
        } catch {
            return { entries: baseEntries, selections: {} };
        }
    },

    async voteMeaning(trackId: string, meaningId: string) {
        try {
            await api.post('/culture/meaning', { trackId, meaningId });
        } catch {
            const feedback = readFeedback();
            feedback.meaningVotes[trackId] = feedback.meaningVotes[trackId] || {};
            feedback.meaningVotes[trackId][meaningId] = (feedback.meaningVotes[trackId][meaningId] || 0) + 1;
            writeFeedback(feedback);
        }
    },

    async react(trackId: string, reactionId: string) {
        try {
            await api.post('/culture/reaction', { trackId, reactionId });
        } catch {
            const feedback = readFeedback();
            feedback.reactions[trackId] = feedback.reactions[trackId] || {};
            feedback.reactions[trackId][reactionId] = (feedback.reactions[trackId][reactionId] || 0) + 1;
            writeFeedback(feedback);
        }
    },
};
