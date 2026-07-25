## Goal
Add a "Training History" panel on `/admin/watcher` so the author can review every past training save, inspect the exact lore/prompt/voice/images used, and restore (retrain) any snapshot with one click.

## Approach
Today `watcher_config` is a single mutable row — every Save overwrites the previous state and nothing is retained. We add an append-only snapshot table that captures a row on every save, then render a history timeline on the admin page with view + restore actions.

## Database (new migration)

New table `public.watcher_training_history`:
- `id uuid pk`
- `created_at timestamptz`
- `created_by uuid` (author who saved)
- `name`, `tagline`, `voice_id`, `system_prompt`, `lore` (text)
- `include_chapters bool`
- `avatar_url text`
- `training_images jsonb` (snapshot of URLs at save time)
- `chapter_count int` (how many published chapters were in scope at save time — for context)
- `note text nullable` (optional label the author can type before saving, e.g. "added Chapter 7 spoilers")

Access rules:
- GRANT to `authenticated` + `service_role` (no anon).
- RLS: only admins (`has_role(auth.uid(),'admin')`) can SELECT / INSERT. No UPDATE / DELETE policy → history is immutable.

Trigger: `AFTER INSERT OR UPDATE ON public.watcher_config` → insert a snapshot row into `watcher_training_history` copying all current fields. This guarantees every save (from any path) is logged automatically, no client-side coordination needed.

Also seed one row from the current `watcher_config` so history isn't empty on first open.

## Frontend (`src/routes/admin.watcher.tsx`)

1. Add optional "Note for this save" input above the Save button — sent as `note` by writing it to `watcher_config.last_note` (new nullable column) right before save so the trigger captures it. (Simpler alternative: pass note by inserting the history row directly from the client after a successful save; we'll go with the direct-insert approach so the trigger stays note-agnostic.)

2. New "Training History" section below the form:
   - `useQuery(['watcher-history'])` selecting from `watcher_training_history` ordered by `created_at desc`, limit 50.
   - Each entry (collapsible card) shows: timestamp, optional note, voice name, chapter count, image thumbnails count, first ~200 chars of lore.
   - Buttons per entry:
     - **View** → expands to show full lore, full system prompt, and the training image thumbnails as they were.
     - **Restore this version** → confirmation, then upserts `watcher_config` with the snapshot's fields (including `training_images`, `avatar_url`, `voice_id`). Trigger records the restore as a new history entry (with note "Restored from <timestamp>").

3. Invalidate `watcher-config-admin`, `watcher-config-public`, and `watcher-history` after save/restore.

## Out of scope
- Diffing between versions.
- Pagination beyond 50 entries.
- Deleting/pruning history (immutable by design).

## Technical notes
- Restore only rewires `watcher_config` fields; it does not re-upload images to storage — snapshot URLs must still exist in the `avatars` bucket. Removing a training image from the current config does NOT delete the storage object today, so historical URLs stay valid.
- Trigger uses `SECURITY DEFINER` + `SET search_path = public` per project conventions.
