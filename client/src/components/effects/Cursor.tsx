import { useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import './Cursor.css';

const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, label, [role="button"]';

export default function Cursor({ children }: PropsWithChildren) {
    const dotRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const precisePointer = window.matchMedia('(any-pointer: fine)');
        if (!precisePointer.matches) return;

        const dot = dotRef.current;
        if (!dot) return;

        let frame = 0;
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;

        const draw = () => {
            dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
            frame = 0;
        };

        const setVisible = (visible: boolean) => {
            dot.dataset.visible = String(visible);
        };

        const handleMove = (event: MouseEvent) => {
            mouseX = event.clientX;
            mouseY = event.clientY;
            setVisible(true);
            if (!frame) frame = window.requestAnimationFrame(draw);
        };

        const handleOver = (event: MouseEvent) => {
            const target = event.target as Element | null;
            dot.dataset.hover = String(Boolean(target?.closest(INTERACTIVE_SELECTOR)));
        };

        const handleLeave = () => setVisible(false);

        document.body.classList.add('custom-cursor-active');
        window.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseover', handleOver);
        document.addEventListener('mouseleave', handleLeave);

        return () => {
            document.body.classList.remove('custom-cursor-active');
            window.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseover', handleOver);
            document.removeEventListener('mouseleave', handleLeave);
            window.cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <>
            {children}
            <div ref={dotRef} className="custom-cursor-dot" aria-hidden="true" />
        </>
    );
}
