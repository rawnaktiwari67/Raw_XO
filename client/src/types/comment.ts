export interface Comment {
    _id: string;
    body: string;
    author: {
        _id: string;
        username: string;
        avatar: string;
        levelBadge: string;
    };
    thread: string;
    parent: string | null;
    depth: number;
    upvotes: string[];
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCommentPayload {
    threadId: string;
    parentId?: string;
    body: string;
}
