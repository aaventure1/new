const buckets = new Map();

function cleanupExpiredBuckets(now) {
    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({
    windowMs = 60_000,
    max = 60,
    key = 'global',
    message = 'Too many requests. Please try again shortly.'
} = {}) {
    return (req, res, next) => {
        const now = Date.now();
        if (buckets.size > 5_000) {
            cleanupExpiredBuckets(now);
        }

        const bucketKey = `${key}:${getClientIp(req)}`;
        const existing = buckets.get(bucketKey);
        const bucket = existing && existing.resetAt > now
            ? existing
            : { count: 0, resetAt: now + windowMs };

        bucket.count += 1;
        buckets.set(bucketKey, bucket);

        if (bucket.count > max) {
            const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: message,
                retryAfter
            });
        }

        return next();
    };
}

module.exports = {
    createRateLimiter
};
