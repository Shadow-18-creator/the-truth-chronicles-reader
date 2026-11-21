import { afterEach, describe, expect, it, vi } from "vitest";
import { persistProfileAvatar, type ProfileAvatarStorage } from "@/lib/profile-avatar";

const publicUrl = "https://images.example.test/user/avatar.png";

function createStorage(overrides: Partial<ProfileAvatarStorage> = {}) {
  const storage: ProfileAvatarStorage = {
    upload: vi.fn(async () => ({ error: null })),
    getPublicUrl: vi.fn(() => publicUrl),
    updateProfileAvatar: vi.fn(async (_userId, avatarUrl) => ({ data: { avatar_url: avatarUrl }, error: null })),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
  return storage;
}

afterEach(() => vi.restoreAllMocks());

describe("profile avatar persistence", () => {
  it("uploads an image, confirms its profile URL, and returns a saved result", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    const storage = createStorage();
    const image = new Blob(["portrait"], { type: "image/png" });

    const result = await persistProfileAvatar("reader-id", image, "png", storage);

    expect(result).toEqual({
      ok: true,
      path: "reader-id/avatar-1234.png",
      avatarUrl: publicUrl,
    });
    expect(storage.upload).toHaveBeenCalledWith("reader-id/avatar-1234.png", image, "image/png");
    expect(storage.updateProfileAvatar).toHaveBeenCalledWith("reader-id", publicUrl);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("does not report success or leave an uploaded file if the profile row is not updated", async () => {
    const storage = createStorage({
      updateProfileAvatar: vi.fn(async () => ({ data: null, error: null })),
    });

    const result = await persistProfileAvatar("reader-id", new Blob(["portrait"]), "png", storage);

    expect(result).toEqual({ ok: false, message: "The profile did not confirm the saved portrait." });
    expect(storage.remove).toHaveBeenCalledWith(expect.stringMatching(/^reader-id\/avatar-\d+\.png$/));
  });

  it("surfaces upload errors without changing the profile", async () => {
    const storage = createStorage({ upload: vi.fn(async () => ({ error: { message: "Upload denied." } })) });

    const result = await persistProfileAvatar("reader-id", new Blob(["portrait"]), "png", storage);

    expect(result).toEqual({ ok: false, message: "Upload denied." });
    expect(storage.updateProfileAvatar).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});