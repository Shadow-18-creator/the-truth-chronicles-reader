# AI-generated 2D profile avatars

## Goal
Add an AI portrait creator beside the existing profile-photo upload so a seeker can describe a character, preview the generated 2D art, and save it as their profile picture. Uploaded photos and generated portraits will use the same existing avatar URL, so the new choice appears everywhere the profile portrait is already shown.

## User experience
- Place two adjacent controls in the profile portrait area: **Upload photo** and **Create with AI**.
- The AI panel will let the user enter a short character description and choose a visual direction such as mystical illustration, manga-inspired, graphic novel, or painterly fantasy.
- Show a generated preview with clear **Use this portrait**, **Generate again**, and **Cancel** actions.
- Save only after the user confirms the preview; show loading, success, rate-limit, credit, and content-policy errors in the panel.
- Keep the existing selectable 2D avatar styles as a fallback. Saving a photo or AI portrait will continue to take precedence over those styles.
- Keep the prompt private to the signed-in user and do not expose any AI credential in browser code.

## Implementation
1. Add an authenticated streaming image-generation server route for avatar requests. Validate the prompt, apply a square portrait instruction that excludes text/logos and asks for a clean 2D character portrait, and call the existing Lovable AI Gateway with the cost-efficient supported image model `google/gemini-3.1-flash-image`.
2. Add the client-side stream parser with progressive preview handling and the required blurred partial-image state. Surface the gateway's actual terminal message; only bounded retry behavior will be used for rate-limit or temporary upstream failures, never for terminal configuration, credit, or policy errors.
3. Add the profile AI panel beside the upload control. Keep the generated image in preview state until confirmation, then upload the resulting PNG through the existing avatar storage flow and update the signed-in profile record.
4. Reuse the existing profile query invalidation so the header, public profile, seeker search, and chat portraits refresh after saving. Preserve the current SVG/type/size protections for all avatar uploads.
5. Add the required dependency for reliable SSE parsing only if it is not already available, then verify the exact image-generation request through the live route and check build/runtime logs.

## Technical notes
- The gateway key stays server-side; this uses the app's existing AI integration rather than asking each reader for a provider key.
- The provider's actual free-tier/credit availability is controlled by the workspace, so the UI will explain when credits or rate limits prevent generation rather than pretending generation is unlimited.
- Generation will be rate-limited per signed-in user and constrained to a short prompt so a public profile action cannot become an unbounded image-generation job.
- No database schema change is needed: the confirmed portrait is stored in the existing profile avatar URL field and remains compatible with every existing portrait location.
