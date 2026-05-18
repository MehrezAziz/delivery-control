/**
 * Resolves a stored image URL to a value usable by <img> in the admin panel.
 *
 * - Absolute URLs (http/https) are returned as-is.
 * - Paths starting with /uploads/ are routed through the /api/images proxy,
 *   which reads from delivery-backend/<path> on the same filesystem.
 * - Any other value is returned as-is.
 */
export function getAdminAssetUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/uploads/")) return `/api/images${url}`;
  if (url.startsWith("uploads/")) return `/api/images/${url}`;
  return url;
}
