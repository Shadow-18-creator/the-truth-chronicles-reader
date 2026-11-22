import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { getTranslationLanguage, TRANSLATION_LANGUAGES } from "@/lib/translation-catalog";
import { isKeeperVisitorId, getKeeperIpRateLimitKey } from "@/lib/keeper";

describe("shared helper behavior", () => {
  it("merges utility classes and resolves conflicting Tailwind classes", () => {
    expect(cn("px-2 text-sm", false && "hidden", "px-4")).toBe("text-sm px-4");
    expect(cn()).toBe("");
  });

  it("finds supported translation languages and leaves unknown codes unresolved", () => {
    expect(getTranslationLanguage("hi")?.name).toBe("Hindi");
    expect(getTranslationLanguage("ur")?.dir).toBe("rtl");
    expect(getTranslationLanguage("unknown")).toBeUndefined();
    expect(TRANSLATION_LANGUAGES.length).toBeGreaterThan(0);
  });

  it("validates Keeper visitor IDs and hashes network identifiers", async () => {
    expect(isKeeperVisitorId("87b330e9-dcb3-4a28-a74e-9ab6c4331234")).toBe(true);
    expect(isKeeperVisitorId("invalid")).toBe(false);
    expect(await getKeeperIpRateLimitKey(null)).toBeNull();
    const hashed = await getKeeperIpRateLimitKey("203.0.113.42");
    expect(hashed).toMatch(/^keeper_ip_[a-f0-9]{64}$/);
    expect(hashed).not.toContain("203.0.113.42");
  });
});