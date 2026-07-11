// Hover text roll: two stacked copies of the label inside a clipped track.
// When an ancestor carrying `.roll-trigger` is hovered, the track slides up one
// line. Pure CSS (see index.css) — this component only provides the structure.
export default function RollText({ children, className = '' }: { children: string; className?: string }) {
    return (
        <span className={`roll-text ${className}`}>
            <span className="roll-text-track">
                <span>{children}</span>
                <span aria-hidden>{children}</span>
            </span>
        </span>
    );
}
