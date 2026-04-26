import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    children: ReactNode;
    isLoading?: boolean;
}

const EASE = [0.25, 0.1, 0.25, 1] as const;

const sizeMap: Record<Size, string> = {
    sm: 'text-xs py-2 px-4',
    md: 'text-sm py-2.5 px-6',
    lg: 'text-sm py-3.5 px-8',
};

export default function Button({
    variant = 'primary',
    size = 'md',
    children,
    isLoading,
    disabled,
    className = '',
    ...rest
}: Props) {
    const isDisabled = isLoading || disabled;
    const sz = sizeMap[size];

    const spinner = (
        <span className="w-3.5 h-3.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
    );

    if (variant === 'primary') {
        return (
            <motion.button
                whileHover={!isDisabled ? { opacity: 0.88, y: -1 } : {}}
                whileTap={!isDisabled ? { scale: 0.98 } : {}}
                transition={{ duration: 0.18, ease: EASE }}
                disabled={isDisabled}
                className={`btn-primary rounded-xl disabled:opacity-40 disabled:cursor-not-allowed ${sz} ${className}`}
                {...(rest as object)}
            >
                {isLoading ? spinner : children}
            </motion.button>
        );
    }

    if (variant === 'secondary' || variant === 'ghost') {
        return (
            <motion.button
                whileHover={!isDisabled ? { y: -1 } : {}}
                whileTap={!isDisabled ? { scale: 0.98 } : {}}
                transition={{ duration: 0.18, ease: EASE }}
                disabled={isDisabled}
                className={`btn-secondary rounded-xl disabled:opacity-40 disabled:cursor-not-allowed ${sz} ${className}`}
                {...(rest as object)}
            >
                {isLoading ? spinner : children}
            </motion.button>
        );
    }

    return (
        <motion.button
            whileHover={!isDisabled ? { opacity: 0.8 } : {}}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
            transition={{ duration: 0.18, ease: EASE }}
            disabled={isDisabled}
            className={`text-sm font-medium text-red-400 hover:text-red-300 transition-colors rounded-xl px-4 py-2.5 bg-red-950/20 border border-red-900/30 ${sz} ${className}`}
            {...(rest as object)}
        >
            {isLoading ? spinner : children}
        </motion.button>
    );
}
