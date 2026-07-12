import { env } from '../config/env';
import type { ChatMessage } from './groqClient';

// Minimal REST client for the Gemini API — the fallback provider behind
// ai/llm.ts. Uses Node's global fetch so no SDK dependency is needed, and
// sends the key as a header (never a query param) so it can't end up in URLs,
// logs, or proxies.

export const hasGeminiKey = Boolean(env.GEMINI_API_KEY);

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 15_000;

type GeminiResponse = {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
    }>;
};

export const geminiChatCompletion = async (
    messages: ChatMessage[],
    options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> => {
    // Gemini splits the OpenAI-style message list: system turns become a
    // dedicated systemInstruction, assistant turns are role "model".
    const system = messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n');
    const contents = messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
        }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(`${GEMINI_BASE_URL}/${env.GEMINI_MODEL}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
                ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
                contents,
                generationConfig: {
                    maxOutputTokens: options.maxTokens ?? 256,
                    temperature: options.temperature ?? 0.3,
                    // Gemini flash models "think" by default, which silently
                    // burns small maxOutputTokens budgets and returns empty
                    // text. These are one-sentence utility calls — never think.
                    thinkingConfig: { thinkingBudget: 0 },
                },
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Gemini API error ${response.status}`);
        }

        const data = (await response.json()) as GeminiResponse;
        return (
            data.candidates?.[0]?.content?.parts
                ?.map((part) => part.text ?? '')
                .join('')
                .trim() ?? ''
        );
    } finally {
        clearTimeout(timer);
    }
};
