import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { aiService } from '../../services/aiService';
import type { ChatTurn, TriviaAnswer } from '../../types/ai';

// Floating trivia chat, bottom-right on every page. Questions go to
// POST /ai/trivia, which answers only from the embedded knowledge base
// (tracks + eras + tours) — see server/src/ai for the RAG pipeline.

const SUGGESTED_QUESTIONS = [
    'What is the After Hours era about?',
    'When did Starboy come out?',
    'Any tour dates in London?',
];

const getApiError = (error: unknown, fallback: string): string => {
    if (typeof error === 'object' && error && 'response' in error) {
        const response = (error as { response?: { data?: { error?: unknown } } }).response;
        if (typeof response?.data?.error === 'string' && response.data.error.trim()) {
            return response.data.error;
        }
    }
    return fallback;
};

function TypingDots() {
    return (
        <div className="flex items-center gap-1 px-1 py-1" aria-label="XO Oracle is thinking">
            {[0, 1, 2].map((index) => (
                <motion.span
                    key={index}
                    className="h-1.5 w-1.5 rounded-full bg-amber/70"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep the newest message in view as the conversation grows.
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [turns, isLoading]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const ask = async (question: string) => {
        const trimmed = question.trim();
        if (!trimmed || isLoading) return;

        setInput('');
        // Snapshot the conversation BEFORE appending the new question — error
        // bubbles are UI chrome, not conversation, so they stay out of history.
        const history = turns.filter((turn) => !turn.error).slice(-6);
        setTurns((current) => [...current, { role: 'user', text: trimmed }]);
        setIsLoading(true);
        try {
            const res = await aiService.askTrivia(trimmed, history);
            const payload = res.data?.data as TriviaAnswer | undefined;
            if (!payload?.answer) throw new Error('Invalid trivia payload');
            setTurns((current) => [...current, { role: 'assistant', text: payload.answer }]);
        } catch (error) {
            setTurns((current) => [...current, {
                role: 'assistant',
                text: getApiError(error, 'Something went sideways — try that again in a moment.'),
                error: true,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6">
            <AnimatePresence>
                {isOpen ? (
                    <motion.section
                        key="chat-panel"
                        initial={{ opacity: 0, y: 16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.97 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="mb-3 flex h-[440px] w-[calc(100vw-2rem)] max-w-[360px] flex-col overflow-hidden rounded-[1.2rem] bg-ch-1 shadow-lift ring-1 ring-white/[0.08]"
                        aria-label="XO Oracle trivia chat"
                    >
                        <header className="relative flex items-center justify-between gap-3 px-4 py-3">
                            <div aria-hidden className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                            <div>
                                <p className="font-heading text-lg leading-none text-text-1">XO Oracle</p>
                                <p className="mt-1 text-[10px] tracking-[0.08em] text-text-4">Trivia from the archive — tracks, eras, tours</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close chat"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-text-3 transition-colors hover:bg-white/[0.1] hover:text-text-1"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
                                    <path d="M6 6l12 12M18 6L6 18" />
                                </svg>
                            </button>
                        </header>

                        <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
                            {turns.length === 0 ? (
                                <div className="space-y-2.5">
                                    <p className="text-xs leading-relaxed text-text-3">
                                        Ask about the songs in the game, The Weeknd's album eras, or tour dates.
                                    </p>
                                    {SUGGESTED_QUESTIONS.map((question) => (
                                        <button
                                            key={question}
                                            type="button"
                                            onClick={() => void ask(question)}
                                            className="block w-full rounded-[0.85rem] bg-white/[0.04] px-3 py-2.5 text-left text-xs text-text-2 ring-1 ring-white/[0.05] transition-colors hover:bg-white/[0.07] hover:text-text-1"
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                turns.map((turn, index) => (
                                    <motion.div
                                        key={`${index}-${turn.role}`}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                        className={`max-w-[85%] rounded-[0.95rem] px-3 py-2.5 text-[13px] leading-relaxed ${
                                            turn.role === 'user'
                                                ? 'ml-auto bg-amber-dim text-text-1 ring-1 ring-amber/20'
                                                : turn.error
                                                    ? 'bg-rose-400/10 text-rose-100/90 ring-1 ring-rose-300/20'
                                                    : 'bg-white/[0.05] text-text-2 ring-1 ring-white/[0.05]'
                                        }`}
                                    >
                                        {turn.text}
                                    </motion.div>
                                ))
                            )}
                            {isLoading ? (
                                <div className="max-w-[85%] rounded-[0.95rem] bg-white/[0.05] px-3 py-2 ring-1 ring-white/[0.05]">
                                    <TypingDots />
                                </div>
                            ) : null}
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void ask(input);
                            }}
                            className="relative flex items-center gap-2 px-3 py-3"
                        >
                            <div aria-hidden className="absolute inset-x-4 top-0 h-px bg-white/[0.06]" />
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                placeholder="Ask the archive…"
                                maxLength={500}
                                className="min-w-0 flex-1 rounded-[0.85rem] bg-white/[0.05] px-3.5 py-2.5 text-[13px] text-text-1 placeholder:text-text-4 ring-1 ring-white/[0.06] outline-none transition-shadow focus:ring-amber/35"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                aria-label="Send question"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-amber text-ch-0 shadow-amber transition-opacity disabled:opacity-40"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                                    <path d="M3.4 20.4l17.4-7.5c.9-.4.9-1.6 0-2L3.4 3.4c-.8-.3-1.6.4-1.3 1.2L4.5 11c.1.3.1.7 0 1l-2.4 6.3c-.3.8.5 1.5 1.3 1.1z" />
                                </svg>
                            </button>
                        </form>
                    </motion.section>
                ) : null}
            </AnimatePresence>

            <motion.button
                type="button"
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsOpen((open) => !open)}
                aria-label={isOpen ? 'Close trivia chat' : 'Open trivia chat'}
                aria-expanded={isOpen}
                className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber text-ch-0 shadow-amber ring-1 ring-white/20"
            >
                {isOpen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5" aria-hidden>
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                        <path d="M12 3C7 3 3 6.6 3 11c0 2 .9 3.9 2.4 5.3-.2 1-.7 2.2-1.6 3.2-.2.2 0 .6.3.5 1.8-.3 3.3-1 4.3-1.7 1.1.4 2.3.7 3.6.7 5 0 9-3.6 9-8s-4-8-9-8z" />
                    </svg>
                )}
            </motion.button>
        </div>
    );
}
