import { motion } from 'framer-motion';

interface Props {
    xp: number;
    level: number;
    badge: string;
}

const LEVEL_XP = [0, 100, 300, 700, 1500, 3000, Infinity];

export default function XPBar({ xp, level, badge }: Props) {
    const currentMin = LEVEL_XP[level - 1] ?? 0;
    const nextXp = LEVEL_XP[level] ?? 3000;
    const pct = Math.min(100, ((xp - currentMin) / (nextXp - currentMin)) * 100);
    const nextLabel = nextXp === Infinity ? '∞' : nextXp.toLocaleString();

    return (
        <div className="w-full">
            {/* Badge + XP label */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <motion.span
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-xs font-heading font-bold uppercase tracking-wider text-sunset-orange"
                    >
                        {badge}
                    </motion.span>
                    <span className="text-xs text-text-subtle opacity-50">Lv.{level}</span>
                </div>
                <span className="text-xs text-text-subtle font-mono">
                    {xp.toLocaleString()} / {nextLabel} XP
                </span>
            </div>

            {/* Track */}
            <div className="xp-bar-track">
                <motion.div
                    className="xp-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.4, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}
                />
            </div>

            {/* Level milestone preview */}
            <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-text-subtle opacity-40">
                    {currentMin.toLocaleString()} XP
                </span>
                <span className="text-[10px] text-text-subtle opacity-40">
                    {nextLabel} XP
                </span>
            </div>
        </div>
    );
}
