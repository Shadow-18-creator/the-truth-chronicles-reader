import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getKeeperIpRateLimitKey,
  isKeeperVisitorId,
  KEEPER_DAILY_LIMIT,
  KEEPER_IP_BURST_LIMIT,
  KEEPER_IP_DAILY_LIMIT,
} from "@/lib/keeper";

const { planner } = vi.hoisted(() => ({ planner: vi.fn() }));
vi.mock("@lovable.dev/ai-gateway", () => ({ generateResponse: planner }));

import { researchForWatcher, researchPublicWeb, runPublicResearch, TinyFishError } from "@/lib/tinyfish.server";

let plan = { research: true, topic: "fiction dialogue writing techniques" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  planner.mockReset();
  planner.mockImplementation(async () => ({
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(plan) }] }],
  }));
  plan = { research: true, topic: "fiction dialogue writing techniques" };
});

describe("TinyFish public research boundaries", () => {
  it("keeps The Keeper's daily and network safeguards", async () => {
    expect(KEEPER_DAILY_LIMIT).toBe(50);
    expect(KEEPER_IP_BURST_LIMIT).toBe(40);
    expect(KEEPER_IP_DAILY_LIMIT).toBe(300);
    expect(isKeeperVisitorId("87b330e9-dcb3-4a28-a74e-9ab6c4331234")).toBe(true);
    expect(isKeeperVisitorId("not-a-visitor-id")).toBe(false);
    const key = await getKeeperIpRateLimitKey("203.0.113.42");
    expect(key).toMatch(/^keeper_ip_[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.42");
  });

  it("sends only abstract public research topics, not private story names", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "test-only-credential");
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(String(init?.body));
      return Response.json({ status: "COMPLETED", result: { summary: "Use dialogue with subtext.", sources: [] } });
    }));

    const result = await researchPublicWeb("Research dialogue techniques for secret character Zorvathi.");

    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("fiction dialogue writing techniques");
    expect(requests[0]).not.toContain("Zorvathi");
    expect(result).toContain("NOT story canon");
  });

  it("does not research ordinary questions or author polish/lore checks", async () => {
    plan = { research: false, topic: "" };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await researchPublicWeb("Who is the main character?")).toBe("");
    expect(await researchForWatcher("polish", "Polish my draft.")).toBe("");
    expect(await researchForWatcher("consistency", "Check continuity.")).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(planner).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the research planner fails and rejects unsafe planned topics", async () => {
    planner.mockRejectedValueOnce(new Error("research unavailable"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await researchForWatcher("chat", "Hello")).toBe("");

    plan = { research: true, topic: "https://private.example/?key=sk-secret" };
    expect(await researchPublicWeb("Research this topic")).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redacts credentials and reports provider failures", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "test-only-credential");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Invalid test-only-credential", { status: 401 })));

    await expect(runPublicResearch("public writing craft")).rejects.toMatchObject({
      constructor: TinyFishError,
      status: 401,
      detail: "Invalid [redacted]",
    });
  });

  it("does not treat incomplete research automation as successful", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "test-only-credential");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "FAILED", result: null, error: { message: "Task failed" } })));
    await expect(runPublicResearch("public writing craft")).rejects.toThrow("Task failed");
  });
});