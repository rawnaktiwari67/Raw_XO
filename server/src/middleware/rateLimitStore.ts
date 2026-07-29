import mongoose, { Schema } from 'mongoose';
import type { Store, Options, ClientRateLimitInfo } from 'express-rate-limit';
import { isDbConnected } from '../config/db';

// A shared, MongoDB-backed fixed-window store for express-rate-limit.
//
// Why this exists: the library's default MemoryStore is per-process. On Vercel's
// serverless runtime every instance has its own memory and cold starts reset it,
// so the auth (brute-force) and AI (LLM cost) limits are effectively unenforced
// across the fleet. Backing the counter with the app's EXISTING MongoDB makes the
// window shared across instances — with zero new infrastructure to provision.
//
// Trade-off: one small DB round-trip per limited request. That's fine here because
// it's applied only to /auth and /ai — low-frequency, high-value endpoints — not
// to the hot game path. It fails OPEN (see increment): if Mongo is unavailable the
// limiter lets the request through rather than taking down sign-in over a limiter
// hiccup. During such an outage cross-instance limiting is lost — an accepted
// availability trade-off for a solo-founder launch.

interface RateLimitHit {
    _id: string;
    count: number;
    expiresAt: Date;
}

const RateLimitSchema = new Schema<RateLimitHit>(
    {
        _id: { type: String },
        count: { type: Number, default: 0 },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false }
);

// TTL sweeper: Mongo drops each doc once expiresAt passes. Correctness does not
// depend on it (increment resets an expired window itself); the index only
// garbage-collects stale keys so the collection stays small.
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Guard against double-registration (hot reload / repeated imports).
const RateLimitModel =
    (mongoose.models.RateLimitHit as mongoose.Model<RateLimitHit>) ||
    mongoose.model<RateLimitHit>('RateLimitHit', RateLimitSchema);

export class MongoRateLimitStore implements Store {
    private windowMs = 60_000;
    private readonly keyPrefix: string;

    constructor(keyPrefix: string) {
        this.keyPrefix = keyPrefix;
    }

    init(options: Options): void {
        this.windowMs = options.windowMs;
    }

    private scopedKey(key: string): string {
        return `${this.keyPrefix}:${key}`;
    }

    async increment(key: string): Promise<ClientRateLimitInfo> {
        const resetTime = new Date(Date.now() + this.windowMs);

        // Fail open when the DB isn't connected (local dev, or an outage).
        if (!isDbConnected()) {
            return { totalHits: 1, resetTime };
        }

        // Atomic conditional reset via an aggregation-pipeline update:
        //  - window still live  -> increment the count, keep expiresAt
        //  - window expired/new -> start a fresh window (count 1, new expiresAt)
        // $$NOW is evaluated server-side so there's no client/server clock skew.
        const pipeline = [
            {
                $set: {
                    count: {
                        $cond: [
                            { $gt: ['$expiresAt', '$$NOW'] },
                            { $add: [{ $ifNull: ['$count', 0] }, 1] },
                            1,
                        ],
                    },
                    expiresAt: {
                        $cond: [{ $gt: ['$expiresAt', '$$NOW'] }, '$expiresAt', resetTime],
                    },
                },
            },
        ] as unknown as mongoose.PipelineStage[];

        try {
            const doc = await RateLimitModel.findOneAndUpdate(
                { _id: this.scopedKey(key) },
                pipeline,
                { upsert: true, new: true }
            ).lean();

            return {
                totalHits: doc?.count ?? 1,
                resetTime: doc?.expiresAt ?? resetTime,
            };
        } catch {
            // Any store error fails open — never block auth/AI on a limiter fault.
            return { totalHits: 1, resetTime };
        }
    }

    async decrement(key: string): Promise<void> {
        if (!isDbConnected()) return;
        try {
            await RateLimitModel.updateOne({ _id: this.scopedKey(key) }, { $inc: { count: -1 } });
        } catch {
            /* best-effort */
        }
    }

    async resetKey(key: string): Promise<void> {
        if (!isDbConnected()) return;
        try {
            await RateLimitModel.deleteOne({ _id: this.scopedKey(key) });
        } catch {
            /* best-effort */
        }
    }
}
