export interface Era {
    _id: string;
    slug: string;
    name: string;
    year: number;
    description: string;
    coverImage: string;
    accentColor: string;
    order: number;
}

export interface Thread {
    _id: string;
    title: string;
    body: string;
    author: {
        _id: string;
        username: string;
        avatar: string;
        levelBadge: string;
    };
    era: {
        _id: string;
        name: string;
        slug: string;
        accentColor: string;
    };
    upvotes: string[];
    downvotes: string[];
    tags: string[];
    isPinned: boolean;
    commentCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateThreadPayload {
    title: string;
    body: string;
    eraId: string;
    tags?: string[];
}
