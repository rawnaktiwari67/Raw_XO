import { clerkClient } from '@clerk/express';
import User from '../models/User';
import { isDbConnected } from '../config/db';
import { devStore } from './devStore';

const buildBaseUsername = (email: string, username?: string | null, firstName?: string | null, lastName?: string | null) => {
    const raw = username
        || [firstName, lastName].filter(Boolean).join(' ')
        || email.split('@')[0]
        || 'rawxo';

    const cleaned = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24);

    return cleaned || 'rawxo';
};

const uniqueDbUsername = async (base: string) => {
    let candidate = base;
    let index = 1;

    while (await User.findOne({ username: candidate })) {
        candidate = `${base}-${index}`.slice(0, 30);
        index += 1;
    }

    return candidate;
};

// Mongo raises code 11000 when an insert violates a unique index. That's exactly
// what happens when two of a new user's first requests race to create the same
// account (see resolveClerkUser) — we treat it as "someone else won the race"
// rather than a hard failure.
const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

const uniqueDevUsername = (base: string) => {
    let candidate = base;
    let index = 1;

    while (devStore.findUserByUsername(candidate)) {
        candidate = `${base}-${index}`.slice(0, 30);
        index += 1;
    }

    return candidate;
};

export const resolveClerkUser = async (clerkUserId: string): Promise<string | null> => {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress
        || clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
        return null;
    }

    const baseUsername = buildBaseUsername(
        primaryEmail,
        clerkUser.username,
        clerkUser.firstName,
        clerkUser.lastName
    );

    if (!isDbConnected()) {
        const existing = devStore.findUserByClerkId(clerkUserId)
            || devStore.findUserByEmail(primaryEmail);
        const username = existing?.username ?? uniqueDevUsername(baseUsername);
        const user = devStore.upsertClerkUser({
            clerkId: clerkUserId,
            username,
            email: primaryEmail,
            avatar: clerkUser.imageUrl,
        });
        return user._id;
    }

    const existing = await User.findOne({
        $or: [
            { clerkId: clerkUserId },
            { email: primaryEmail.toLowerCase() },
        ],
    });

    if (existing) {
        existing.clerkId = clerkUserId;
        existing.email = primaryEmail.toLowerCase();
        existing.avatar = clerkUser.imageUrl || existing.avatar;
        await existing.save();
        return existing._id.toString();
    }

    const username = await uniqueDbUsername(baseUsername);
    try {
        const created = await User.create({
            clerkId: clerkUserId,
            username,
            email: primaryEmail.toLowerCase(),
            passwordHash: 'clerk-managed',
            avatar: clerkUser.imageUrl || '',
        });

        return created._id.toString();
    } catch (error) {
        // A new user's first authenticated page load fires several requests in
        // parallel (session, leaderboard, stats, /me). All see "no user" above and
        // all try to create it; the unique index on clerkId/email means every
        // request but one throws E11000. Without this branch those requests would
        // 401 (protect) or silently drop the user's score/XP (optionalProtect) —
        // making every new signup's first session flaky. On a duplicate-key race we
        // re-query and return whoever the winning insert created.
        if (isDuplicateKeyError(error)) {
            const raced = await User.findOne({
                $or: [
                    { clerkId: clerkUserId },
                    { email: primaryEmail.toLowerCase() },
                ],
            });
            if (raced) {
                if (!raced.clerkId) {
                    raced.clerkId = clerkUserId;
                    await raced.save();
                }
                return raced._id.toString();
            }
        }
        throw error;
    }
};
