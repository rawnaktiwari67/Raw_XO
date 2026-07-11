import api from './api';
import type { ChatTurn } from '../types/ai';

export const aiService = {
    // history lets the server resolve follow-ups ("when did IT come out?") —
    // it replays recent turns to the model and widens retrieval with them.
    askTrivia: (question: string, history: ChatTurn[] = []) =>
        api.post('/ai/trivia', {
            question,
            history: history.map(({ role, text }) => ({ role, text })),
        }),
    // trackId is the round's encrypted songId token — the server decodes it for
    // the track metadata, so the client never has to (and can't) send raw answers.
    getHint: (trackId: string, guessesUsed: number) =>
        api.post('/ai/hint', { trackId, guessesUsed }),
};
