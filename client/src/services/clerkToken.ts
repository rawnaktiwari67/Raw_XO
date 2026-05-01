type ClerkTokenGetter = () => Promise<string | null>;

let clerkTokenGetter: ClerkTokenGetter | null = null;

export const setClerkTokenGetter = (getter: ClerkTokenGetter | null) => {
    clerkTokenGetter = getter;
};

export const getClerkToken = async () => {
    if (!clerkTokenGetter) {
        return null;
    }

    try {
        return await clerkTokenGetter();
    } catch {
        return null;
    }
};
