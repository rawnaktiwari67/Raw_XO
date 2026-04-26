import { useRef, type ReactNode, type MouseEvent } from 'react';
import './SpotlightCard.css';

interface SpotlightCardProps {
    children: ReactNode;
    className?: string;
    spotlightColor?: string;
}

export default function SpotlightCard({
    children,
    className = '',
    spotlightColor = 'rgba(255, 255, 255, 0.25)',
}: SpotlightCardProps) {
    const divRef = useRef<HTMLDivElement | null>(null);

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        const element = divRef.current;
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        element.style.setProperty('--mouse-x', `${x}px`);
        element.style.setProperty('--mouse-y', `${y}px`);
        element.style.setProperty('--spotlight-color', spotlightColor);
    };

    return (
        <div ref={divRef} onMouseMove={handleMouseMove} className={`card-spotlight ${className}`}>
            {children}
        </div>
    );
}
