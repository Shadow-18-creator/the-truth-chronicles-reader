## Good news first

Two things you asked about already exist in the project, so we don't have to start from zero:

1. **`public/robots.txt`** is already present — it tells Google "you can crawl everything" and points to the sitemap.
2. **`src/routes/sitemap[.]xml.ts`** dynamically lists every page (home, chapters, every chapter slug, chat, users, profiles). Google uses this to discover your full site.

And about the "JavaScript single-page" concern: this project is **TanStack Start**, which **server-renders every route by default**. When Googlebot fetches `/chapters/<slug>`, it receives fully-rendered HTML with that chapter's title, description, and content — not an empty shell. So Google already sees this as a multi-page website, not a SPA.

The real reason a JS site can look like "one page" to Google is when each route reuses the home page's `<title>`/`<meta>` tags. I checked — most routes have their own `head()`, but a couple are too thin, and none of them advertise a canonical URL. That's what to fix.

## What to change

### 1. Verify `robots.txt` — no edits needed
Current content is already correct:
```
User-agent: *
Allow: /

Sitemap: https://the-truth-chronicles-reader.lovable.app/sitemap.xml
```
I'll just confirm it's there and explain it in chat.

### 2. Beef up thin route metadata
Two routes only set a `<title>` — add `description`, `og:title`, `og:description`, `og:type`, `twitter:*` so each shares distinctly on social and indexes with its own snippet:
- `src/routes/users.tsx`
- `src/routes/auth.tsx` (will also keep `noindex` since it's a sign-in page — auth pages shouldn't be in Google results)

### 3. Add canonical URL + `og:url` to every public route
This is the single biggest signal that tells Google "this is a distinct page with its own address." Add per route (leaf only — never on `__root.tsx`, per TanStack docs):
- `/` (index.tsx)
- `/chapters` (chapters.tsx)
- `/chapters/$slug` (chapters.$slug.tsx — dynamic, built from `params.slug`)
- `/chat` (chat.tsx)
- `/users` (users.tsx)
- `/u/$username` (u.$username.tsx — dynamic)
- `/bookmarks`, `/profile` — add `noindex` (private user pages)
- `/auth`, `/admin` — keep `noindex` (already on admin)

### 4. Stronger structured data
- `src/routes/chapters.$slug.tsx`: add JSON-LD `Article` schema (headline, datePublished, author, articleBody snippet) built from loader data — gets chapters eligible for richer Google results.
- `src/routes/chapters.tsx`: add JSON-LD `Book` + `ItemList` of chapters so Google understands this is a novel with an ordered chapter list.

### 5. Keep sitemap accurate
The sitemap server route already includes chapters and user profiles. No change needed unless you want me to also drop `/auth`, `/bookmarks`, `/profile` from it (they shouldn't be indexed). Recommended: remove `/auth`.

## What I won't touch

- `__root.tsx` site-wide defaults stay (canonical/og:url belong on leaves only — adding them to root would emit duplicates across every page).
- Page content, layout, styling. This is metadata-only.
- The sitemap mechanism itself.

After this, ask Google Search Console to "Request indexing" on a couple of chapter URLs and you'll see each route appear as its own result.