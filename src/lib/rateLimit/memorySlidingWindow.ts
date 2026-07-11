/** In-memory sliding window (best for single Node instance). */

type Bucket = number[];

const store = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs;
  while (bucket.length > 0 && bucket[0]! < cutoff) {
    bucket.shift();
  }
}

/**
 * Returns whether another hit is allowed. On success, records `now` as a hit.
 * @param key Stable key e.g. `checkin:eventId:ip`
 */
export function hitSlidingWindow(
  key: string,
  maxHits: number,
  windowMs: number,
  now = Date.now()
): { ok: true } | { ok: false; retryAfterMs: number } {
  let bucket = store.get(key);
  if (!bucket) {
    bucket = [];
    store.set(key, bucket);
  }
  prune(bucket, windowMs, now);
  if (bucket.length >= maxHits) {
    const oldest = bucket[0]!;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return { ok: false, retryAfterMs };
  }
  bucket.push(now);
  if (store.size > 50_000) {
    for (const [k, b] of store) {
      prune(b, windowMs, now);
      if (b.length === 0) store.delete(k);
    }
  }
  return { ok: true };
}
