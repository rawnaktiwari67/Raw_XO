import api from './api';

export const aiService = {
    // trackId is the round's encrypted songId token — the server decodes it for
    // the track metadata, so the client never has to (and can't) send raw answers.
    getHint: (trackId: string, guessesUsed: number) =>
        api.post('/ai/hint', { trackId, guessesUsed }),
};
