import { afterEach, describe, expect, mock, test } from "bun:test";
import { getKeeperIpRateLimitKey, isKeeperVisitorId, KEEPER_DAILY_LIMIT, KEEPER_IP_BURST_LIMIT, KEEPER_IP_DAILY_LIMIT } from "./keeper";

let plan = { research: true, topic: "fiction dialogue writing techniques" };
const planner = mock(async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(plan) }] }] }));
mock.module("@lovable.dev/ai-gateway", () => ({ generateResponse: planner }));
const { researchPublicWeb, runPublicResearch, TinyFishError } = await import("./tinyfish.server");
const originalFetch = globalThis.fetch;
const originalKey = process.env.TINYFISH_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.TINYFISH_API_KEY = originalKey;
  plan = { research: true, topic: "fiction dialogue writing techniques" };
  planner.mockClear();
});

describe("TinyFish public research boundaries", () => {
  test("Keeper retains 50 messages per reader per day", () => {
    expect(KEEPER_DAILY_LIMIT).toBe(50);
  });
  test("anonymous Keeper access keeps its visitor and network safeguards", async () => {
    expect(KEEPER_IP_BURST_LIMIT).toBe(40);
    expect(KEEPER_IP_DAILY_LIMIT).toBe(300);
    expect(isKeeperVisitorId("87b330e9-dcb3-4a28-a74e-9ab6c4331234")).toBe(true);
    expect(isKeeperVisitorId("not-a-visitor-id")).toBe(false);
    const ipKey = await getKeeperIpRateLimitKey("203.0.113.42");
    expect(ipKey).toMatch(/^keeper_ip_[0-9a-f]{64}$/);
    expect(ipKey).not.toContain("203.0.113.42");
  });
  test("sends only the abstract public topic, not private text, to TinyFish", async () => {
    process.env.TINYFISH_API_KEY = "test-only-credential";
    const requests = [];
    globalThis.fetch = mock(async (_input, init) => {
      requests.push(String(init?.body));
      return Response.json({ status: "COMPLETED", result: { summary: "Use dialogue with subtext.", sources: [] } });
    });
    const result = await researchPublicWeb("Research dialogue techniques for my secret character Zorvathi.");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("fiction dialogue writing techniques");
    expect(requests[0]).not.toContain("Zorvathi");
    expect(result).toContain("NOT story canon");
  });
  test("ordinary story questions do not start a TinyFish run", async () => {
    plan = { research: false, topic: "" };
    const fetchMock = mock(async () => Response.json({}));
    globalThis.fetch = fetchMock;
    expect(await researchPublicWeb("Who is the main character?")).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("rejects links and credentials accidentally returned by the planner", async () => {
    plan = { research: true, topic: "https://private.example/?key=sk-secret" };
    const fetchMock = mock(async () => Response.json({}));
    globalThis.fetch = fetchMock;
    expect(await researchPublicWeb("Research this topic")).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("preserves provider status and redacts the credential from failure details", async () => {
    process.env.TINYFISH_API_KEY = "test-only-credential";
    globalThis.fetch = mock(async () => new Response("Invalid test-only-credential", { status: 401 }));
    try {
      await runPublicResearch("public writing craft");
      throw new Error("Expected provider failure");
    } catch (error) {
      expect(error).toBeInstanceOf(TinyFishError);
      if (!(error instanceof TinyFishError)) throw error;
      expect(error.status).toBe(401);
      expect(error.detail).toBe("Invalid [redacted]");
    }
  });
  test("failed automation is not treated as successful research", async () => {
    process.env.TINYFISH_API_KEY = "test-only-credential";
    globalThis.fetch = mock(async () => Response.json({ status: "FAILED", result: null, error: { message: "Task failed" } }));
    await expect(runPublicResearch("public writing craft")).rejects.toThrow("Task failed");
  });
});