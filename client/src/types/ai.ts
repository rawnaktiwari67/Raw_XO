// Payload shapes for the /ai routes (see server/src/controllers/ai.controller.ts).

export interface TriviaSource {
    source: 'track' | 'era' | 'tour';
    refId: string;
}

export interface TriviaAnswer {
    answer: string;
    sources: TriviaSource[];
}

export interface HintResponse {
    hint: string;
    guessesUsed: number;
}

// One bubble in the ChatWidget conversation.
export interface ChatTurn {
    role: 'user' | 'assistant';
    text: string;
    error?: boolean;
}
