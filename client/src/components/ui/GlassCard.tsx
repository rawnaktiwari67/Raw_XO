import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

const EASE = [0.25, 0.1, 0.25, 1] as const;

export default function GlassCard({ children, className = '', onClick }: Props) {
    return (
        <motion.div
            whileHover={onClick ? { y: -4, boxShadow: '0 12px 48px rgba(0,0,0,0.65)', borderColor: 'rgba(255,255,255,0.09)' } : { y: -4, borderColor: 'rgba(255,255,255,0.09)' }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={onClick}
            className={`glass shimmer-hover ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
            {children}
        </motion.div>
    );
}
