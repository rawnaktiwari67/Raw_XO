import { Request, Response } from 'express';
import { isDbConnected } from '../config/db';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { decodeSongToken } from '../utils/songTokens';
import { chatCompletion, hasGroqKey } from '../ai/groqClient';
import { retrieveTopK, hasKnowledgeBase } from '../ai/vectorStore';
import { buildTriviaMessages, buildHintMessages, redactHintLeaks, TRIVIA_FALLBACK } from '../ai/prompts';

const MAX_QUESTION_LENGTH = 500;

// Hint tiers cap at "5+ guesses" — anything above 8 changes nothing, so clamp
// rather than reject.
const MAX_GUESSES_USED = 8;

// POST /ai/trivia
// RAG pipeline: embed the question → retrieve top-k chunks from the knowledge
// base → ask Groq to answer from those chunks only.
export const askTrivia = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!hasGroqKey) {
            res.status(503).json(errorResponse('AI features are not configured (GROQ_API_KEY missing).'));
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

        const chunks = await retrieveTopK(question);

        // Nothing cleared the relevance floor — skip the LLM call entirely.
        // Answering from zero context could only produce hallucination.
        if (chunks.length === 0) {
            res.json(successResponse({ answer: TRIVIA_FALLBACK, sources: [] }));
            return;
        }

        const answer = await chatCompletion(buildTriviaMessages(question, chunks), {
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
        if (!hasGroqKey) {
            res.status(503).json(errorResponse('AI features are not configured (GROQ_API_KEY missing).'));
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
