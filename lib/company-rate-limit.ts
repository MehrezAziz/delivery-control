type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  status: number;
  constructor(message: string, status = 429) {
    super(message);
    this.status = status;
  }
}

export function enforceCompanyRateLimit(
  keyParts: Array<string | null | undefined>,
  maxRequests: number,
  windowMs: number,
) {
  const key = keyParts.map((p) => (p ?? "__null__")).join("|");
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= maxRequests) {
    throw new RateLimitError("Rate limit exceeded", 429);
  }

  current.count += 1;
  buckets.set(key, current);
}
