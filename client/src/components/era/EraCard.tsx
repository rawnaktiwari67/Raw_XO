import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';
import type { Era } from '../../types/thread';

interface Props { era: Era; index: number; }

const EASE = [0.25, 0.1, 0.25, 1] as const;

export default function EraCard({ era, index }: Props) {
    const cardRef = useRef<HTMLDivElement>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), { stiffness: 200, damping: 30, mass: 0.5 });
    const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), { stiffness: 200, damping: 30, mass: 0.5 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const r = cardRef.current?.getBoundingClientRect();
        if (!r) return;
        mouseX.set((e.clientX - r.left) / r.width - 0.5);
        mouseY.set((e.clientY - r.top) / r.height - 0.5);
    };
    const reset = () => { mouseX.set(0); mouseY.set(0); };

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: index * 0.07, ease: EASE }}
            style={{ perspective: 1200 }}
        >
            <Link to={`/era/${era.slug}`} className="block group">
                <motion.div
                    ref={cardRef}
                    style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={reset}
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.32, ease: EASE }}
                    className="surface-1 shimmer-hover p-6 h-full flex flex-col gap-4 cursor-pointer select-none overflow-hidden"
                >
                    {/* Year — micro label */}
                    <span className="label-xs">{era.year}</span>

                    {/* Name */}
                    <h3 className="font-heading font-bold text-text-1 text-xl leading-tight group-hover:text-text-1 transition-colors">
                        {era.name}
                    </h3>

                    {/* Description */}
                    <p className="text-text-3 text-sm leading-relaxed line-clamp-3 flex-1">
                        {era.description}
                    </p>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                        <span
                            className="text-xs font-semibold tracking-tight transition-all duration-300 group-hover:opacity-100 opacity-60"
                            style={{ color: era.accentColor }}
                        >
                            Explore
                        </span>
                        {/* Era color fragment — restrained */}
                        <div
                            className="w-5 h-[2px] rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-300"
                            style={{ background: era.accentColor }}
                        />
                    </div>

                    {/* Bottom accent line — appears on hover */}
                    <div
                        className="absolute bottom-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-60 transition-opacity duration-500"
                        style={{ background: `linear-gradient(90deg, transparent, ${era.accentColor}80, transparent)` }}
                    />
                </motion.div>
            </Link>
        </motion.div>
    );
}
