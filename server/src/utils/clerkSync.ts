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
    const created = await User.create({
        clerkId: clerkUserId,
        username,
        email: primaryEmail.toLowerCase(),
        passwordHash: 'clerk-managed',
        avatar: clerkUser.imageUrl || '',
    });

    return created._id.toString();
};
