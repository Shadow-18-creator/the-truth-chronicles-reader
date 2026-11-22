import { describe, expect, it } from "vitest";
import { buildWatcherSystemPrompt } from "@/lib/watcher-prompt";

const baseContext = {
  name: "The Watcher",
  basePrompt: "Be a thoughtful writing partner.",
  lore: "The silver key opens the eastern gate.",
  retrieved: "A storm began at dusk.",
  chapterSummaryCorpus: "Chapter 1: The hero leaves home.",
  trainingImageCount: 1,
};

describe("Watcher prompt construction", () => {
  it("includes trusted lore, retrieved passages, chapter summaries, images, and an author draft", () => {
    const prompt = buildWatcherSystemPrompt({ ...baseContext, draft: "A draft passage." });

    expect(prompt).toContain("The silver key opens the eastern gate.");
    expect(prompt).toContain("A storm began at dusk.");
    expect(prompt).toContain("Chapter 1: The hero leaves home.");
    expect(prompt).toContain("1 training image(s)");
    expect(prompt).toContain("A draft passage.");
    expect(prompt).toContain("untrusted user input");
  });

  it("selects polish and continuity instructions by mode", () => {
    expect(buildWatcherSystemPrompt({ ...baseContext, mode: "polish" })).toContain("Return the polished passage first");
    expect(buildWatcherSystemPrompt({ ...baseContext, mode: "consistency" })).toContain("private continuity editor");
  });

  it("omits empty optional context", () => {
    const prompt = buildWatcherSystemPrompt({
      ...baseContext,
      lore: "",
      retrieved: "",
      chapterSummaryCorpus: "",
      trainingImageCount: 0,
    });

    expect(prompt).not.toContain("# Additional Lore");
    expect(prompt).not.toContain("# Retrieved knowledge");
    expect(prompt).not.toContain("# Story Chapters");
    expect(prompt).not.toContain("# Visual references");
  });
});