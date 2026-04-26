export const LEVEL_MAP = [
    { minXp: 0, level: 1, badge: 'XO Initiate' },
    { minXp: 100, level: 2, badge: 'A-List Fan' },
    { minXp: 300, level: 3, badge: 'Era Scholar' },
    { minXp: 700, level: 4, badge: 'Starboy' },
    { minXp: 1500, level: 5, badge: 'After Hours' },
    { minXp: 3000, level: 6, badge: 'Dawn FM Legend' },
];

export const calculateLevel = (xp: number): { level: number; badge: string } => {
    const entry = [...LEVEL_MAP].reverse().find((l) => xp >= l.minXp);
    return entry
        ? { level: entry.level, badge: entry.badge }
        : { level: 1, badge: 'XO Initiate' };
};

export const calculateGameXP = (correct: boolean, streak: number): number => {
    if (!correct) return 5;
    const base = 50;
    const streakBonus = Math.min(streak * 10, 50);
    return base + streakBonus;
};

export const ACTION_XP = {
    CREATE_THREAD: 20,
    CREATE_COMMENT: 10,
    RECEIVE_UPVOTE: 5,
};
