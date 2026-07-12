import { Request, Response } from 'express';
import { isDbConnected } from '../config/db';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { decodeSongToken } from '../utils/songTokens';
import { chatCompletion, hasLlmProvider } from '../ai/llm';
import { retrieveTopKMulti, hasKnowledgeBase } from '../ai/vectorStore';
import {
    buildTriviaMessages, buildHintMessages, redactHintLeaks,
    TRIVIA_FALLBACK, TriviaHistoryTurn,
} from '../ai/prompts';

const MAX_QUESTION_LENGTH = 500;

// Follow-up support: how much of the widget conversation is replayed to the
// model, and how long any single replayed turn may be. Enough to resolve
// "when did IT come out?", small enough that history can't balloon the prompt.
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_TEXT_LENGTH = 500;

// Anything malformed is silently dropped rather than rejected — history is a
// nicety, and a stale client that doesn't send it must keep working.
const parseHistory = (raw: unknown): TriviaHistoryTurn[] => {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((turn): turn is { role: string; text: string } =>
            typeof turn === 'object' && turn !== null
            && ((turn as { role?: unknown }).role === 'user' || (turn as { role?: unknown }).role === 'assistant')
            && typeof (turn as { text?: unknown }).text === 'string'
            && Boolean((turn as { text: string }).text.trim()))
        .slice(-MAX_HISTORY_TURNS)
        .map((turn) => ({
            role: turn.role as TriviaHistoryTurn['role'],
            text: turn.text.trim().slice(0, MAX_HISTORY_TEXT_LENGTH),
        }));
};

// Hint tiers cap at "5+ guesses" — anything above 8 changes nothing, so clamp
// rather than reject.
const MAX_GUESSES_USED = 8;

// POST /ai/trivia
// RAG pipeline: embed the question → retrieve top-k chunks from the knowledge
// base → ask Groq to answer from those chunks only.
export const askTrivia = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!hasLlmProvider) {
            res.status(503).json(errorResponse('AI features are not configured (set GROQ_API_KEY or GEMINI_API_KEY).'));
            return;
        }
        if (!isDbConnected()) {
            res.status(503).json(errorResponse('Trivia knowledge base unavailable.'));
            return;
        }

        const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
        if (!question) {
            res.status(400).json(errorResponse('question is required'));
            return;
        }
        if (question.length > MAX_QUESTION_LENGTH) {
            res.status(400).json(errorResponse(`question must be at most ${MAX_QUESTION_LENGTH} characters`));
            return;
        }

        if (!(await hasKnowledgeBase())) {
            res.status(503).json(errorResponse('Trivia knowledge base is empty — run `npm run embed` in server/.'));
            return;
        }

        const history = parseHistory(req.body.history);

        // A follow-up like "and what songs are on it?" embeds to nothing useful
        // on its own — the entity it refers to lives in the previous user turn.
        // Retrieve on both the raw question and a history-expanded phrasing and
        // let the best-scoring chunks win (retrieveTopKMulti merges by score).
        const lastUserTurn = [...history].reverse().find((turn) => turn.role === 'user');
        const queries = lastUserTurn ? [question, `${lastUserTurn.text} ${question}`] : [question];
        const chunks = await retrieveTopKMulti(queries);

        // Nothing cleared the relevance floor — skip the LLM call entirely.
        // Answering from zero context could only produce hallucination.
        if (chunks.length === 0) {
            res.json(successResponse({ answer: TRIVIA_FALLBACK, sources: [] }));
            return;
        }

        const answer = await chatCompletion(buildTriviaMessages(question, chunks, history), {
            maxTokens: 220,
            temperature: 0.2,
        });

        res.json(successResponse({
            answer: answer || TRIVIA_FALLBACK,
            sources: chunks.map((chunk) => ({ source: chunk.source, refId: chunk.refId })),
        }));
    } catch {
        res.status(500).json(errorResponse('Trivia assistant unavailable'));
    }
};

// POST /ai/hint
// No RAG here: the trackId the client holds is the game's encrypted song token,
// so the track's metadata is decoded server-side (tamper-proof, no DB read) and
// handed to the hint prompt. Specificity scales with guessesUsed; the prompt
// plus redactHintLeaks guarantee the title/artist are never revealed.
export const generateHint = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!hasLlmProvider) {
            res.status(503).json(errorResponse('AI features are not configured (set GROQ_API_KEY or GEMINI_API_KEY).'));
            return;
        }

        const { trackId } = req.body;
        if (!trackId || typeof trackId !== 'string') {
            res.status(400).json(errorResponse('trackId is required'));
            return;
        }

        const song = decodeSongToken(trackId);
        if (!song) {
            res.status(400).json(errorResponse('Invalid track token'));
            return;
        }

        const guessesUsed = Math.min(MAX_GUESSES_USED, Math.max(1, Number(req.body.guessesUsed) || 1));

        const hint = await chatCompletion(buildHintMessages(song, guessesUsed), {
            maxTokens: 80,
            temperature: 0.7,
        });

        if (!hint) {
            res.status(502).json(errorResponse('Hint generation failed'));
            return;
        }

        res.json(successResponse({
            hint: redactHintLeaks(hint, song),
            guessesUsed,
        }));
    } catch {
        res.status(500).json(errorResponse('Hint assistant unavailable'));
    }
};
