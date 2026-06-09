## Goal

On the home page, add two pieces of novel-level content that you (as admin) can edit inline:

1. **Tag chips** (e.g., "Psychological", "Action", "Supernatural", "Mythology meets Cyberpunk") rendered as styled badges below the hero / above the latest chapters.
2. **A collapsible "About the story" summary** dropdown, also above the latest chapters, below the title section.

Both will be editable directly on the home page when signed in as admin — no separate admin screen needed.

## Backend changes

Create a new singleton settings table so values persist and any future page can reuse them.

**New table `public.novel_meta`** (single row, enforced by a `singleton` boolean primary-key trick):

| column | type | notes |
|---|---|---|
| `id` | `boolean` PK, default `true`, check `id = true` | enforces single row |
| `summary` | `text` | the About paragraph(s) |
| `tags` | `text[]` default `'{}'` | tag list, free-form strings |
| `updated_at` | `timestamptz` default `now()` | |

**RLS / grants**
- `GRANT SELECT ON public.novel_meta TO anon, authenticated;` (publicly readable so the home page renders the summary/tags for everyone)
- `GRANT INSERT, UPDATE ON public.novel_meta TO authenticated;` (gated by policy below)
- `GRANT ALL ON public.novel_meta TO service_role;`
- Enable RLS.
- Policies:
  - `SELECT`: `USING (true)` — public read.
  - `INSERT`: `WITH CHECK (public.has_role(auth.uid(), 'admin'))`
  - `UPDATE`: `USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'))`
- Seed the single row in the same migration with empty defaults so the home page always has something to read from.

## Frontend changes (only `src/routes/index.tsx`)

Insert a new section between the hero (line 80) and the "Latest Chapters" section (line 82):

- Fetch `novel_meta` via `useQuery`.
- **Tags row**: render each tag as a `<Badge>` chip in a centered flex-wrap. If no tags and not admin, hide section. If admin, show an "Edit tags" pencil button.
- **Summary disclosure**: use the existing shadcn `Collapsible` (or `<details>` styled) with trigger label "About the story" + chevron icon. Closed by default. Renders `summary` text inside. If admin and empty, shows "Add a summary".
- **Inline admin editor** (only for `isAdmin`, from `useAuth()`):
  - Tags: a small dialog/popover with a textarea (one tag per line) or comma-separated input. Save calls `supabase.from('novel_meta').update({ tags }).eq('id', true)`. Invalidate the query.
  - Summary: an edit pencil opens a `<Textarea>` inline; Save updates `summary` the same way.
- Use existing UI primitives (`Badge`, `Button`, `Textarea`, `Collapsible`, `Dialog`) — no new dependencies.

## What I won't touch

- Other routes, components, the chapters table, styling tokens.
- No admin page additions — editing happens on the home page itself, gated by `isAdmin`.

## Edit visibility

Only you (admin) see the edit buttons. Everyone else just sees the chips + the collapsible About section.