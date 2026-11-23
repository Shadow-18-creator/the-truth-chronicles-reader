import { isIP } from "node:net";

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".test",
  ".invalid",
  ".example",
];

const NON_PUBLIC_IPV4_RANGES: Array<{ network: string; prefix: number }> = [
  { network: "0.0.0.0", prefix: 8 },
  { network: "10.0.0.0", prefix: 8 },
  { network: "100.64.0.0", prefix: 10 },
  { network: "127.0.0.0", prefix: 8 },
  { network: "169.254.0.0", prefix: 16 },
  { network: "172.16.0.0", prefix: 12 },
  { network: "192.0.0.0", prefix: 24 },
  { network: "192.0.2.0", prefix: 24 },
  { network: "192.88.99.0", prefix: 24 },
  { network: "192.168.0.0", prefix: 16 },
  { network: "198.18.0.0", prefix: 15 },
  { network: "198.51.100.0", prefix: 24 },
  { network: "203.0.113.0", prefix: 24 },
  { network: "224.0.0.0", prefix: 4 },
  { network: "240.0.0.0", prefix: 4 },
];

function ipv4ToNumber(address: string): number {
  return address.split(".").reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function isNonPublicIpv4(address: string): boolean {
  const value = ipv4ToNumber(address);
  return NON_PUBLIC_IPV4_RANGES.some(({ network, prefix }) => {
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) >>> 0 === (ipv4ToNumber(network) & mask) >>> 0;
  });
}

/** Validates that a URL points to a public HTTP(S) destination. */
export function validatePublicHttpUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Only public HTTP(S) URLs can be imported");
  }

  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Only public HTTP(S) URLs can be imported");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const address = hostname.replace(/^\[|\]$/g, "");
  const family = isIP(address);

  if (
    !hostname.includes(".") ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    family === 6 ||
    (family === 4 && isNonPublicIpv4(address))
  ) {
    throw new Error("Only public HTTP(S) URLs can be imported");
  }

  return url;
}

/** Fetches a public page, validating the destination again at every redirect. */
export async function fetchPublicPage(
  input: string,
  fetcher: (input: URL, init: RequestInit) => Promise<Response> = fetch,
): Promise<Response> {
  let url = validatePublicHttpUrl(input);

  for (let redirects = 0; ; redirects += 1) {
    const response = await fetcher(url, {
      headers: { "User-Agent": "WatcherBot/1.0" },
      redirect: "manual",
    });

    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location || redirects >= MAX_REDIRECTS) {
      throw new Error("The page redirected too many times or returned an invalid redirect");
    }

    await response.body?.cancel().catch(() => undefined);
    url = validatePublicHttpUrl(new URL(location, url).toString());
  }
}