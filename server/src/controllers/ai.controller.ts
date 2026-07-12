import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { decodeSongToken } from '../utils/songTokens';
import { chatCompletion, hasLlmProvider } from '../ai/llm';
import { buildHintMessages, redactHintLeaks } from '../ai/prompts';

// Hint tiers cap at "5+ guesses" — anything above 8 changes nothing, so clamp
// rather than reject.
const MAX_GUESSES_USED = 8;

// POST /ai/hint
// The trackId the client holds is the game's encrypted song token, so the
// track's metadata is decoded server-side (tamper-proof, no DB read) and
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
