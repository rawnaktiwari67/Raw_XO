import { motion } from 'framer-motion';

export type PillOption<T extends string> = { value: T; label: string };

type FilterPillsProps<T extends string> = {
    options: PillOption<T>[];
    value: T;
    onChange: (value: T) => void;
    size?: 'sm' | 'md';
    className?: string;
};

// Shared pill row used by both the Rank and Culture pages so the toggles read
// the same everywhere. The active pill carries the warm amber wash already used
// across the app; inactive pills are quiet until hovered.
export default function FilterPills<T extends string>({
    options,
    value,
    onChange,
    size = 'md',
    className = '',
}: FilterPillsProps<T>) {
    const pad = size === 'sm' ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-[11px]';

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <motion.button
                        key={option.value}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onChange(option.value)}
                        className={`tap-target inline-flex items-center justify-center rounded-full uppercase tracking-[0.14em] transition-all duration-300 ${pad} ${
                            active
                                ? 'bg-[linear-gradient(180deg,rgba(244,162,97,0.22),rgba(244,162,97,0.10))] text-text-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(244,162,97,0.14)]'
                                : 'bg-white/[0.03] text-text-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:text-text-1'
                        }`}
                    >
                        {option.label}
                    </motion.button>
                );
            })}
        </div>
    );
}
