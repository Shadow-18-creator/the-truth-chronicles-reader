export interface ProfileAvatarStorage {
  upload(path: string, image: Blob, contentType: string): Promise<{ error: { message: string } | null }>;
  getPublicUrl(path: string): string;
  updateProfileAvatar(userId: string, avatarUrl: string): Promise<{
    data: { avatar_url: string | null } | null;
    error: { message: string } | null;
  }>;
  remove(path: string): Promise<unknown>;
}

export type ProfileAvatarSaveResult =
  | { ok: true; path: string; avatarUrl: string }
  | { ok: false; message: string };

/** Stores an avatar and requires the profile URL to read back before succeeding. */
export async function persistProfileAvatar(
  userId: string,
  image: Blob,
  extension: string,
  storage: ProfileAvatarStorage,
): Promise<ProfileAvatarSaveResult> {
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  let uploaded = false;

  try {
    const uploadResult = await storage.upload(path, image, image.type || `image/${extension}`);
    if (uploadResult.error) return { ok: false, message: uploadResult.error.message };
    uploaded = true;

    const avatarUrl = storage.getPublicUrl(path);
    if (!avatarUrl) throw new Error("The uploaded portrait has no public URL.");

    const profileResult = await storage.updateProfileAvatar(userId, avatarUrl);
    if (profileResult.error) throw new Error(profileResult.error.message);
    if (profileResult.data?.avatar_url !== avatarUrl) {
      throw new Error("The profile did not confirm the saved portrait.");
    }

    return { ok: true, path, avatarUrl };
  } catch (error) {
    if (uploaded) {
      try {
        await storage.remove(path);
      } catch {
        // Preserve the original failure; cleanup is limited to this user's avatar path.
      }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The portrait could not be saved.",
    };
  }
}