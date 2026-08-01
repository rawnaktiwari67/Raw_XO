import { describe, it, expect, vi, beforeEach } from 'vitest';

// resolveClerkUser is called for EVERY authenticated request. On a brand-new
// user's first page load several such requests run in parallel, all miss the
// user, and all try to create it — the unique index on clerkId/email makes every
// insert but one throw a duplicate-key error (Mongo code 11000). These tests pin
// the behaviour that a racing insert re-queries and resolves to the winner rather
// than 401-ing the user, which was the pre-fix launch bug.

const { UserMock, getUserMock } = vi.hoisted(() => ({
    UserMock: {
        findOne: vi.fn(),
        create: vi.fn(),
    },
    getUserMock: vi.fn(),
}));

vi.mock('../models/User', () => ({ default: UserMock }));
vi.mock('../config/db', () => ({ isDbConnected: () => true }));
vi.mock('@clerk/express', () => ({
    clerkClient: { users: { getUser: getUserMock } },
}));

import { resolveClerkUser } from './clerkSync';

const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
        primaryEmailAddress: { emailAddress: 'newuser@example.com' },
        emailAddresses: [{ emailAddress: 'newuser@example.com' }],
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        imageUrl: 'https://img.example/avatar.png',
    });
});

describe('resolveClerkUser', () => {
    it('returns the existing user id without creating when one already exists', async () => {
        UserMock.findOne.mockResolvedValueOnce({
            _id: { toString: () => 'existing-id' },
            clerkId: 'clerk_1',
            email: 'newuser@example.com',
            avatar: '',
            save: vi.fn().mockResolvedValue(undefined),
        });

        const id = await resolveClerkUser('clerk_1');

        expect(id).toBe('existing-id');
        expect(UserMock.create).not.toHaveBeenCalled();
    });

    it('recovers from a duplicate-key race by re-querying the winner', async () => {
        // 1) no existing user, 2) uniqueDbUsername check finds no clash,
        // 3) create loses the race (E11000), 4) post-catch re-query finds the
        //    user the winning request created.
        UserMock.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                _id: { toString: () => 'winner-id' },
                clerkId: 'clerk_2',
                save: vi.fn().mockResolvedValue(undefined),
            });
        UserMock.create.mockRejectedValueOnce(duplicateKeyError());

        const id = await resolveClerkUser('clerk_2');

        expect(id).toBe('winner-id');
    });

    it('links clerkId on the raced winner when it was created by email only', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        UserMock.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                _id: { toString: () => 'email-user-id' },
                clerkId: undefined,
                save,
            });
        UserMock.create.mockRejectedValueOnce(duplicateKeyError());

        const id = await resolveClerkUser('clerk_3');

        expect(id).toBe('email-user-id');
        expect(save).toHaveBeenCalledOnce();
    });

    it('rethrows non-duplicate creation errors', async () => {
        UserMock.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        UserMock.create.mockRejectedValueOnce(new Error('connection reset'));

        await expect(resolveClerkUser('clerk_4')).rejects.toThrow('connection reset');
    });

    it('returns null when the Clerk account has no email', async () => {
        getUserMock.mockResolvedValueOnce({
            primaryEmailAddress: null,
            emailAddresses: [],
        });

        const id = await resolveClerkUser('clerk_5');

        expect(id).toBeNull();
        expect(UserMock.create).not.toHaveBeenCalled();
    });
});
