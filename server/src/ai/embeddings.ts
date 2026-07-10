// Local sentence embeddings via @xenova/transformers (all-MiniLM-L6-v2).
// Runs fully in-process — the ~23MB quantized model is downloaded once into
// node_modules' cache on first use, so there is no API key and no network call
// per embedding after warm-up.

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

type FeatureExtractor = (
    texts: string | string[],
    options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

// @xenova/transformers is ESM-only, but this server compiles to CommonJS. A
// literal `import()` here would be transpiled by tsc into a `require()` (which
// throws ERR_REQUIRE_ESM), so the dynamic import is built with the Function
// constructor to keep it out of tsc's reach. Node 22 evaluates it natively.
const importTransformers = (): Promise<typeof import('@xenova/transformers')> =>
    (Function('return import("@xenova/transformers")')() as Promise<typeof import('@xenova/transformers')>);

const getExtractor = (): Promise<FeatureExtractor> => {
    if (!extractorPromise) {
        extractorPromise = importTransformers()
            .then(({ pipeline }) => pipeline('feature-extraction', EMBEDDING_MODEL))
            .then((extractor) => extractor as unknown as FeatureExtractor)
            .catch((error) => {
                // Reset so a transient failure (e.g. first-run model download
                // offline) doesn't poison every future request.
                extractorPromise = null;
                throw error;
            });
    }
    return extractorPromise;
};

/**
 * Embed a batch of texts into unit-normalized 384-dim vectors. Mean pooling +
 * normalization means cosine similarity between any two outputs is just their
 * dot product.
 */
export const embedTexts = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) return [];

    const extractor = await getExtractor();
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const [count, dims] = output.dims;

    const vectors: number[][] = [];
    for (let i = 0; i < count; i += 1) {
        vectors.push(Array.from(output.data.slice(i * dims, (i + 1) * dims)));
    }
    return vectors;
};

export const embedText = async (text: string): Promise<number[]> => {
    const [vector] = await embedTexts([text]);
    return vector;
};
