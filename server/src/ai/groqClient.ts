import Groq from 'groq-sdk';
import { env } from '../config/env';

// Thin seam over the Groq SDK so controllers deal in "messages in, text out"
// and the SDK/model choice stays swappable in one place.

export type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

let client: Groq | null = null;

export const hasGroqKey = Boolean(env.GROQ_API_KEY);

const getClient = (): Groq => {
    if (!client) {
        client = new Groq({ apiKey: env.GROQ_API_KEY });
    }
    return client;
};

export const chatCompletion = async (
    messages: ChatMessage[],
    options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> => {
    const completion = await getClient().chat.completions.create({
        model: env.GROQ_MODEL,
        messages,
        max_tokens: options.maxTokens ?? 256,
        temperature: options.temperature ?? 0.3,
    });

    return completion.choices[0]?.message?.content?.trim() ?? '';
};
