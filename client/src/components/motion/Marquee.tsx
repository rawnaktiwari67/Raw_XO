import type { ReactNode } from 'react';

// Infinite marquee strip. Content is duplicated once and the track translates
// -50%, so the loop is seamless as long as the two groups are identical.
// Decorative only — hidden from assistive tech.
export default function Marquee({
    children,
    duration = 28,
    className = '',
}: {
    children: ReactNode;
    duration?: number;
    className?: string;
}) {
    return (
        <div className={`marquee ${className}`} aria-hidden>
            <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
                <div className="marquee-group">{children}</div>
                <div className="marquee-group">{children}</div>
            </div>
        </div>
    );
}
