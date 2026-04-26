import fs from 'fs';
import path from 'path';

type DevUser = {
    _id: string;
    clerkId?: string;
    username: string;
    email: string;
    passwordHash: string;
    avatar: string;
    bio: string;
    xp: number;
    level: number;
    levelBadge: string;
    createdAt: string;
    updatedAt: string;
};

type DevGameScore = {
    _id: string;
    user: string;
    trackId: string;
    trackName: string;
    artistName: string;
    artworkUrl: string;
    trackUrl: string;
    correct: boolean;
    responseTimeMs: number;
    score: number;
    correctCount: number;
    totalQuestions: number;
    xpEarned: number;
    sessionDate: string;
};

type DevTrackRating = {
    _id: string;
    user: string;
    trackId: string;
    trackName: string;
    artistName: string;
    artworkUrl: string;
    trackUrl: string;
    rating: number;
    createdAt: string;
    updatedAt: string;
};

type DevDb = {
    users: DevUser[];
    gameScores: DevGameScore[];
    ratings: DevTrackRating[];
    cultureSignals: DevCultureSignal[];
    cultureReviews: DevCultureReview[];
};

type DevCultureSignal = {
    trackId: string;
    meaningVotes: Record<string, number>;
    reactions: Record<string, number>;
    updatedAt: string;
};

type DevCultureReview = {
    _id: string;
    trackId: string;
    user?: string;
    username: string;
    title: string;
    artist: string;
    albumArt: string;
    rating: number;
    moodTag: string;
    take: string;
    createdAt: string;
    updatedAt: string;
};

const dbPath = path.resolve(process.cwd(), 'dev-data.json');

const emptyDb = (): DevDb => ({
    users: [],
    gameScores: [],
    ratings: [],
    cultureSignals: [],
    cultureReviews: [],
});

const readDb = (): DevDb => {
    if (!fs.existsSync(dbPath)) return emptyDb();
    try {
        const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as Partial<DevDb>;
        return {
            users: parsed.users || [],
            gameScores: parsed.gameScores || [],
            ratings: parsed.ratings || [],
            cultureSignals: parsed.cultureSignals || [],
            cultureReviews: parsed.cultureReviews || [],
        };
    } catch {
        return emptyDb();
    }
};

const writeDb = (db: DevDb): void => {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
};

const publicUser = (user: DevUser) => ({
    _id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    xp: user.xp,
    level: user.level,
    levelBadge: user.levelBadge,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

const id = (prefix: string): string =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const devStore = {
    findUserByEmail(email: string) {
        const db = readDb();
        return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
    },

    findUserByUsername(username: string) {
        const db = readDb();
        return db.users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null;
    },

    findUserById(userId?: string) {
        if (!userId) return null;
        const db = readDb();
        return db.users.find((user) => user._id === userId) ?? null;
    },

    findUserByClerkId(clerkId?: string) {
        if (!clerkId) return null;
        const db = readDb();
        return db.users.find((user) => user.clerkId === clerkId) ?? null;
    },

    createUser(input: { username: string; email: string; passwordHash: string }) {
        const db = readDb();
        const now = new Date().toISOString();
        const user: DevUser = {
            _id: id('user'),
            clerkId: undefined,
            username: input.username,
            email: input.email.toLowerCase(),
            passwordHash: input.passwordHash,
            avatar: '',
            bio: '',
            xp: 0,
            level: 1,
            levelBadge: 'Raw Listener',
            createdAt: now,
            updatedAt: now,
        };
        db.users.push(user);
        writeDb(db);
        return user;
    },

    upsertClerkUser(input: { clerkId: string; username: string; email: string; avatar: string }) {
        const db = readDb();
        const now = new Date().toISOString();
        const byClerkId = db.users.find((user) => user.clerkId === input.clerkId);
        const byEmail = db.users.find((user) => user.email.toLowerCase() === input.email.toLowerCase());
        const user = byClerkId ?? byEmail;

        if (user) {
            user.clerkId = input.clerkId;
            user.username = input.username;
            user.email = input.email.toLowerCase();
            user.avatar = input.avatar;
            user.updatedAt = now;
            writeDb(db);
            return user;
        }

        const created: DevUser = {
            _id: id('user'),
            clerkId: input.clerkId,
            username: input.username,
            email: input.email.toLowerCase(),
            passwordHash: 'clerk-managed',
            avatar: input.avatar,
            bio: '',
            xp: 0,
            level: 1,
            levelBadge: 'XO Initiate',
            createdAt: now,
            updatedAt: now,
        };
        db.users.push(created);
        writeDb(db);
        return created;
    },

    incrementUserXp(userId: string | undefined, amount: number) {
        if (!userId || amount <= 0) return null;
        const db = readDb();
        const user = db.users.find((item) => item._id === userId);
        if (!user) return null;
        user.xp += amount;
        user.updatedAt = new Date().toISOString();
        writeDb(db);
        return user;
    },

    saveGameScore(input: Omit<DevGameScore, '_id' | 'sessionDate'>) {
        const db = readDb();
        const score: DevGameScore = {
            _id: id('game'),
            sessionDate: new Date().toISOString(),
            ...input,
        };
        db.gameScores.push(score);
        writeDb(db);
        return score;
    },

    saveRating(input: Omit<DevTrackRating, '_id' | 'createdAt' | 'updatedAt'>) {
        const db = readDb();
        const now = new Date().toISOString();
        const existing = db.ratings.find(
            (rating) => rating.user === input.user && rating.trackId === input.trackId
        );
        if (existing) {
            existing.rating = input.rating;
            existing.trackName = input.trackName;
            existing.artistName = input.artistName;
            existing.artworkUrl = input.artworkUrl;
            existing.trackUrl = input.trackUrl;
            existing.updatedAt = now;
            writeDb(db);
            return existing;
        }
        const rating: DevTrackRating = {
            _id: id('rating'),
            createdAt: now,
            updatedAt: now,
            ...input,
        };
        db.ratings.push(rating);
        writeDb(db);
        return rating;
    },

    getHistory(userId?: string, limit = 20) {
        const db = readDb();
        return db.gameScores
            .filter((score) => score.user === userId)
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
            .slice(0, limit);
    },

    getStats(userId?: string) {
        const db = readDb();
        const history = db.gameScores
            .filter((score) => score.user === userId)
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
        const totalGamesPlayed = history.length;
        const totalCorrect = history.filter((score) => score.correct).length;
        const accuracy = totalGamesPlayed > 0 ? Math.round((totalCorrect / totalGamesPlayed) * 100) : 0;
        const timedHistory = history.filter((score) => score.responseTimeMs > 0);
        let streak = 0;
        let bestStreak = 0;
        let runningStreak = 0;
        for (const score of history) {
            if (!score.correct) break;
            streak += 1;
        }
        for (const score of [...history].reverse()) {
            if (score.correct) {
                runningStreak += 1;
                bestStreak = Math.max(bestStreak, runningStreak);
            } else {
                runningStreak = 0;
            }
        }

        return {
            totalGamesPlayed,
            totalCorrect,
            accuracy,
            streak,
            bestStreak,
            ratingsCount: db.ratings.filter((rating) => rating.user === userId).length,
            averageResponseTimeMs: timedHistory.length > 0
                ? Math.round(timedHistory.reduce((sum, score) => sum + score.responseTimeMs, 0) / timedHistory.length)
                : 0,
            fastestCorrectResponseTimeMs: history
                .filter((score) => score.correct && score.responseTimeMs > 0)
                .reduce((best, score) => best === 0 ? score.responseTimeMs : Math.min(best, score.responseTimeMs), 0),
        };
    },

    getLeaderboard(period: 'daily' | 'all-time' = 'all-time', userId?: string) {
        const db = readDb();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const ranked = db.users
            .map((user) => {
                const scores = db.gameScores.filter((score) =>
                    score.user === user._id &&
                    (period !== 'daily' || new Date(score.sessionDate).getTime() >= todayStart.getTime())
                );
                return {
                    _id: user._id,
                    username: user.username,
                    avatar: user.avatar,
                    levelBadge: user.levelBadge,
                    totalScore: scores.reduce((sum, score) => sum + score.score, 0),
                    sessions: scores.length,
                    xpTotal: scores.reduce((sum, score) => sum + score.xpEarned, 0),
                };
            })
            .filter((entry) => entry.sessions > 0)
            .sort((a, b) => b.totalScore - a.totalScore)
        ;

        return {
            entries: ranked.slice(0, 50),
            userRank: userId ? ranked.findIndex((entry) => entry._id === userId) + 1 || null : null,
            period,
        };
    },

    getCultureSignals(trackIds: string[]) {
        const db = readDb();
        const requested = new Set(trackIds);
        return db.cultureSignals.filter((signal) => requested.has(signal.trackId));
    },

    voteCultureMeaning(trackId: string, meaningId: string) {
        const db = readDb();
        const now = new Date().toISOString();
        let signal = db.cultureSignals.find((entry) => entry.trackId === trackId);
        if (!signal) {
            signal = { trackId, meaningVotes: {}, reactions: {}, updatedAt: now };
            db.cultureSignals.push(signal);
        }
        signal.meaningVotes[meaningId] = (signal.meaningVotes[meaningId] || 0) + 1;
        signal.updatedAt = now;
        writeDb(db);
        return signal;
    },

    reactCultureTrack(trackId: string, reactionId: string) {
        const db = readDb();
        const now = new Date().toISOString();
        let signal = db.cultureSignals.find((entry) => entry.trackId === trackId);
        if (!signal) {
            signal = { trackId, meaningVotes: {}, reactions: {}, updatedAt: now };
            db.cultureSignals.push(signal);
        }
        signal.reactions[reactionId] = (signal.reactions[reactionId] || 0) + 1;
        signal.updatedAt = now;
        writeDb(db);
        return signal;
    },

    getCultureReviews(trackId?: string, limit = 20) {
        const db = readDb();
        return db.cultureReviews
            .filter((review) => !trackId || review.trackId === trackId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    },

    saveCultureReview(input: Omit<DevCultureReview, '_id' | 'createdAt' | 'updatedAt'>) {
        const db = readDb();
        const now = new Date().toISOString();
        const review: DevCultureReview = {
            _id: id('culture_review'),
            createdAt: now,
            updatedAt: now,
            ...input,
        };
        db.cultureReviews.push(review);
        writeDb(db);
        return review;
    },

    publicUser,
};
