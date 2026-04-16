// Stable idempotency key helper for client -> BFF.
// We use a deterministic hash of the payload to allow safe retries.

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime 16777619
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function buildIdempotencyKey(scope: string, payload: unknown): string {
  const payloadStr = JSON.stringify(payload);
  const h = fnv1a32(payloadStr);
  return `${scope}_${h}`;
}

