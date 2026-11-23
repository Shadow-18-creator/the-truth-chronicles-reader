import { describe, expect, it, vi } from "vitest";
import { fetchPublicPage, validatePublicHttpUrl } from "@/lib/watcher-url.server";

describe("Watcher public URL import boundary", () => {
  it("accepts public HTTP and HTTPS domains", () => {
    expect(validatePublicHttpUrl("https://example.com/story").hostname).toBe("example.com");
    expect(validatePublicHttpUrl("http://public.example.org").protocol).toBe("http:");
  });

  it.each([
    "http://localhost/admin",
    "http://service.local/private",
    "http://metadata.google.internal/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://10.2.3.4/",
    "http://169.254.169.254/",
    "http://192.168.1.10/",
    "http://[::1]/",
    "http://user:pass@example.com/",
  ])("rejects non-public destination %s", (url) => {
    expect(() => validatePublicHttpUrl(url)).toThrow("Only public HTTP(S) URLs can be imported");
  });

  it("follows public redirects but blocks a redirect into a private network", async () => {
    const fetcher = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://www.example.com/page" } }))
      .mockResolvedValueOnce(new Response("page", { status: 200 }));

    const response = await fetchPublicPage("https://example.com/", fetcher);

    expect(await response.text()).toBe("page");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1].redirect).toBe("manual");

    const privateRedirectFetcher = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } }));

    await expect(fetchPublicPage("https://example.com/", privateRedirectFetcher)).rejects.toThrow(
      "Only public HTTP(S) URLs can be imported",
    );
    expect(privateRedirectFetcher).toHaveBeenCalledTimes(1);
  });

  it("stops redirect loops after the configured limit", async () => {
    const fetcher = vi.fn<(input: URL, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: "/next" } }));

    await expect(fetchPublicPage("https://example.com/", fetcher)).rejects.toThrow("redirected too many times");
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
});