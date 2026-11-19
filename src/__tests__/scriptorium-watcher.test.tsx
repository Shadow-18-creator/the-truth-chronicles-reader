import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getSession, toastError, toastSuccess } = vi.hoisted(() => ({
  getSession: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));

import { ScriptoriumWatcher } from "@/components/ScriptoriumWatcher";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  getSession.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("Scriptorium Watcher interactions", () => {
  it("asks for chapter text before polishing an empty draft", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptoriumWatcher draft="  " onUseText={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    expect(toastError).toHaveBeenCalledWith("Write something in the chapter first.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends polish requests, shows the response, and lets the author use it", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      expect(JSON.parse(String(options.body))).toMatchObject({ mode: "polish", draft: "A rough passage." });
      return Response.json({ reply: "A refined passage.\n\n- Sharpened the image." });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onUseText = vi.fn();
    render(<ScriptoriumWatcher draft="A rough passage." onUseText={onUseText} />);

    fireEvent.click(screen.getByRole("button", { name: /polish/i }));

    expect(await screen.findByText(/A refined passage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use polished text" }));
    expect(onUseText).toHaveBeenCalledWith("A refined passage.");
    expect(toastSuccess).toHaveBeenCalledWith("Polished text placed in your chapter.");
  });

  it("sends lore-check mode and displays API errors", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      expect(JSON.parse(String(options.body))).toMatchObject({ mode: "consistency", draft: "A passage." });
      return new Response("The Watcher is silent.", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptoriumWatcher draft="A passage." onUseText={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /lore check/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("The Watcher is silent."));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports missing author sessions without calling the API", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptoriumWatcher draft="A passage." onUseText={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /lore check/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Sign in again to reach the Watcher."));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});