type ClerkTokenGetter = () => Promise<string | null>;

let clerkTokenGetter: ClerkTokenGetter | null = null;
const TOKEN_RETRY_DELAYS_MS = [0, 150, 350, 700];

const wait = (ms: number) =>
    new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });

export const setClerkTokenGetter = (getter: ClerkTokenGetter | null) => {
    clerkTokenGetter = getter;
};

export const getClerkToken = async () => {
    if (!clerkTokenGetter) {
        return null;
    }

    for (const delay of TOKEN_RETRY_DELAYS_MS) {
        if (delay > 0) await wait(delay);

        try {
            const token = await clerkTokenGetter();
            if (token) return token;
        } catch {
            return null;
        }
    }

    return null;
};
