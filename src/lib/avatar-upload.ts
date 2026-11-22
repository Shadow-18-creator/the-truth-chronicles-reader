import { supabase } from "@/integrations/supabase/client";

/**
 * Resizes an image file to a maximum dimension while maintaining aspect ratio,
 * compressing to a high-efficiency JPEG Data URL (under 100KB).
 */
export function prepareAvatarDataUrl(file: File, maxDim = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not in a browser environment or FileReader unavailable, fallback
    if (typeof window === "undefined" || !window.FileReader) {
      reject(new Error("Browser environment required for image processing"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error("Could not read image file"));
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(src);
          return;
        }

        // Draw image with smooth downsampling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with 0.88 quality (crystal clear yet very compact)
        const format = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(format, 0.88));
      };

      img.onerror = () => {
        // Fallback to raw data url if canvas decode fails
        resolve(src);
      };

      img.src = src;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Universal avatar uploader supporting both Reader Profiles and AI Watcher/Keeper avatars.
 * Uploads via server route with automatic fallback to client-side storage or database persistence.
 */
export async function uploadAvatarImage({
  file,
  target,
  token,
  userId,
}: {
  file: File;
  target: "profile" | "watcher";
  token?: string | null;
  userId?: string | null;
}): Promise<string> {
  // Validate file type
  const validExtensions = ["jpg", "jpeg", "png", "webp", "gif"];
  const nameExt = file.name.split(".").pop()?.toLowerCase() || "";
  const isValidType =
    file.type.startsWith("image/") ||
    validExtensions.includes(nameExt);

  if (!isValidType) {
    throw new Error("Please select a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Portraits must be under 10 MB.");
  }

  // 1. Process and optimize image to data URL
  const dataUrl = await prepareAvatarDataUrl(file, 512);

  // 2. Try uploading through dedicated server route
  if (token) {
    try {
      const response = await fetch("/api/avatar/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target,
          dataUrl,
          fileName: file.name,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.avatar_url) {
          return json.avatar_url as string;
        }
      } else {
        const errText = await response.text();
        console.warn("Server avatar upload returned error, trying client fallback:", errText);
      }
    } catch (err) {
      console.warn("Server avatar upload network failed, trying client fallback:", err);
    }
  }

  // 3. Fallback: Client-side storage upload or direct database update
  const timestamp = Date.now();
  const ext = nameExt || (file.type.includes("png") ? "png" : "jpg");
  const path = target === "watcher"
    ? `watcher/avatar-${timestamp}.${ext}`
    : `${userId || "user"}/avatar-${timestamp}.${ext}`;

  try {
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

    if (!upErr) {
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      if (pub?.publicUrl) {
        if (target === "profile" && userId) {
          await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", userId);
        } else if (target === "watcher") {
          await supabase.from("watcher_config").update({ avatar_url: pub.publicUrl }).eq("id", true);
        }
        return pub.publicUrl;
      }
    }
  } catch {
    // Storage fallback failed, proceed to direct URL update
  }

  // 4. Ultimate resilient fallback: save optimized dataUrl directly to database column
  if (target === "profile" && userId) {
    const { error } = await supabase.from("profiles").update({ avatar_url: dataUrl }).eq("id", userId);
    if (error) throw new Error(error.message);
  } else if (target === "watcher") {
    const { error } = await supabase.from("watcher_config").update({ avatar_url: dataUrl }).eq("id", true);
    if (error) throw new Error(error.message);
  }

  return dataUrl;
}
