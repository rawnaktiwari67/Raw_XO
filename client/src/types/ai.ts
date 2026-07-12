// Payload shapes for the /ai routes (see server/src/controllers/ai.controller.ts).

export interface HintResponse {
    hint: string;
    guessesUsed: number;
}
