const counters = new Map();
const timings = new Map();

function increment(metric, value = 1) {
    const next = (counters.get(metric) || 0) + Number(value || 0);
    counters.set(metric, next);
    return next;
}

function observeMs(metric, durationMs) {
    const safeDuration = Math.max(0, Number(durationMs || 0));
    if (!timings.has(metric)) {
        timings.set(metric, { count: 0, totalMs: 0, minMs: safeDuration, maxMs: safeDuration });
    }

    const bucket = timings.get(metric);
    bucket.count += 1;
    bucket.totalMs += safeDuration;
    bucket.minMs = Math.min(bucket.minMs, safeDuration);
    bucket.maxMs = Math.max(bucket.maxMs, safeDuration);
}

function snapshot() {
    const countersObj = {};
    for (const [key, value] of counters.entries()) {
        countersObj[key] = value;
    }

    const timingsObj = {};
    for (const [key, value] of timings.entries()) {
        timingsObj[key] = {
            count: value.count,
            totalMs: Number(value.totalMs.toFixed(2)),
            avgMs: value.count > 0 ? Number((value.totalMs / value.count).toFixed(2)) : 0,
            minMs: Number(value.minMs.toFixed(2)),
            maxMs: Number(value.maxMs.toFixed(2))
        };
    }

    return {
        capturedAt: new Date().toISOString(),
        counters: countersObj,
        timings: timingsObj
    };
}

function reset() {
    counters.clear();
    timings.clear();
}

module.exports = {
    increment,
    observeMs,
    snapshot,
    reset
};
