// Shared settings for The Keeper, the public reader companion.
export const KEEPER_DAILY_LIMIT = 50;
export const KEEPER_NAME = "The Keeper";
export const KEEPER_ANONYMOUS_BURST_LIMIT = 8;
export const KEEPER_IP_BURST_LIMIT = 40;
export const KEEPER_IP_DAILY_LIMIT = 300;

export function isKeeperVisitorId(value: string | null): value is string {
  return value !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getKeeperIpRateLimitKey(ipAddress: string | null): Promise<string | null> {
  const address = ipAddress?.trim();
  if (!address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `keeper_ip_${hash}`;
}
