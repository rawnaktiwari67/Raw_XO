import { chatCompletion as groqChatCompletion, hasGroqKey } from './groqClient';
import type { ChatMessage } from './groqClient';
import { geminiChatCompletion, hasGeminiKey } from './geminiClient';

// Provider seam for the AI routes. Groq is primary (fastest tokens/sec for
// these one-sentence answers); Gemini takes over when Groq is unconfigured or
// a call fails (free-tier rate limit, model deprecation, outage). Controllers
// only ever see "messages in, text out" and never know which provider ran.

export type { ChatMessage };

export const hasLlmProvider = hasGroqKey || hasGeminiKey;

export const chatCompletion = async (
    messages: ChatMessage[],
    options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> => {
    if (hasGroqKey) {
        try {
            return await groqChatCompletion(messages, options);
        } catch (error) {
            if (!hasGeminiKey) throw error;
            console.warn(
                `[ai] Groq call failed (${error instanceof Error ? error.message : 'unknown'}) — falling back to Gemini`
            );
        }
    }
    return geminiChatCompletion(messages, options);
};
