import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const uploadSchema = z.object({
  target: z.enum(["profile", "watcher"]),
  dataUrl: z.string().min(20).max(7 * 1024 * 1024), // Max ~5MB raw payload
  fileName: z.string().max(255).optional(),
}).strict();

export const Route = createFileRoute("/api/avatar/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Sign in to update portraits.", { status: 401 });
          }

          const token = authHeader.slice("Bearer ".length).trim();
          const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
          const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!url || !publishableKey || !token) {
            return new Response("Authentication service unavailable.", { status: 503 });
          }

          // User authenticated client
          const authClient = createClient<Database>(url, publishableKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: userData, error: userError } = await authClient.auth.getUser(token);
          const userId = userData?.user?.id;
          if (userError || !userId) {
            return new Response("Your session has expired. Please sign in again.", { status: 401 });
          }

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return new Response("Invalid upload payload.", { status: 400 });
          }

          const parsed = uploadSchema.safeParse(body);
          if (!parsed.success) {
            return new Response("Invalid image data provided.", { status: 400 });
          }

          const { target, dataUrl, fileName } = parsed.data;

          // Admin check if modifying watcher avatar
          if (target === "watcher") {
            const { data: roleRow } = await authClient
              .from("user_roles")
              .select("role")
              .eq("user_id", userId)
              .eq("role", "admin")
              .maybeSingle();

            // Check if any admin exists in the system
            const { count: adminCount } = await authClient
              .from("user_roles")
              .select("id", { count: "exact", head: true })
              .eq("role", "admin");

            // Allow if user is admin OR if no admin exists yet (first setup)
            if (!roleRow && (adminCount ?? 0) > 0) {
              return new Response("Only authors/admins can change The Keeper's portrait.", { status: 403 });
            }
          }

          // Parse mime type and extract base64 data
          const mimeMatch = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!mimeMatch) {
            return new Response("Invalid image format. Expected a valid base64 data URL.", { status: 400 });
          }

          const mimeType = mimeMatch[1];
          const base64Data = mimeMatch[2];
          const buffer = Buffer.from(base64Data, "base64");

          let ext = "jpg";
          if (mimeType.includes("png")) ext = "png";
          else if (mimeType.includes("webp")) ext = "webp";
          else if (mimeType.includes("gif")) ext = "gif";
          else if (fileName) {
            const fileExt = fileName.split(".").pop()?.toLowerCase();
            if (fileExt && ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)) {
              ext = fileExt === "jpeg" ? "jpg" : fileExt;
            }
          }

          // Storage client: Prefer serviceRoleKey to bypass storage RLS friction if configured,
          // otherwise use authClient
          const storageClient = serviceRoleKey
            ? createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
            : authClient;

          const timestamp = Date.now();
          const storagePath = target === "watcher"
            ? `watcher/avatar-${timestamp}.${ext}`
            : `${userId}/avatar-${timestamp}.${ext}`;

          let finalAvatarUrl = dataUrl;
          let storageUploaded = false;

          try {
            const { error: uploadError } = await storageClient.storage
              .from("avatars")
              .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: true,
              });

            if (!uploadError) {
              const { data: pub } = storageClient.storage.from("avatars").getPublicUrl(storagePath);
              if (pub?.publicUrl) {
                finalAvatarUrl = pub.publicUrl;
                storageUploaded = true;
              }
            } else {
              console.warn("Storage bucket upload failed, using inline fallback:", uploadError.message);
            }
          } catch (storageEx) {
            console.warn("Storage exception, using inline fallback:", storageEx);
          }

          // Persist the avatar URL into the database
          if (target === "profile") {
            const { error: profileError } = await authClient
              .from("profiles")
              .update({ avatar_url: finalAvatarUrl })
              .eq("id", userId);

            if (profileError) {
              console.error("Profile avatar_url update failed:", profileError);
              return new Response(profileError.message, { status: 500 });
            }
          } else if (target === "watcher") {
            const dbClient = serviceRoleKey
              ? createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
              : authClient;

            const { error: watcherError } = await dbClient
              .from("watcher_config")
              .update({ avatar_url: finalAvatarUrl })
              .eq("id", true);

            if (watcherError) {
              console.error("Watcher avatar_url update failed:", watcherError);
              return new Response(watcherError.message, { status: 500 });
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              avatar_url: finalAvatarUrl,
              storage: storageUploaded ? "bucket" : "inline",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err) {
          console.error("Avatar upload handler error:", err);
          return new Response("An unexpected error occurred while saving the portrait.", { status: 500 });
        }
      },
    },
  },
});
