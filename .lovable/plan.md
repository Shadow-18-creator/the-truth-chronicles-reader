# Scale & Capacity Plan

## Where you stand today

The site runs on edge servers (auto-scaling, no single machine to crash) with a managed Postgres database and realtime service behind it. Static pages and chapter reads scale very well. Three things will break first under load, and one of them is already expensive on every single request.

Verified in the code:

1. **Watcher chat sends your whole novel to the AI on every message.** `src/routes/api/watcher.chat.ts` fetches every published chapter's full `content` and pastes it into the system prompt, on top of the 8 retrieved passages it already has. With 50 chapters that's a huge prompt per message — slow answers, high AI cost, and the first thing to fall over with concurrent users.
2. **Chat rooms load 200 messages at once** (`src/routes/chat.$slug.tsx`) and open one realtime channel per open tab. Fine for dozens of readers, strained in the hundreds.
3. **Chapter list loads every chapter plus every rating aggregate on one page** (`src/routes/chapters.tsx`) with no pagination.

## Honest capacity numbers (current setup)

| Area | Comfortable now | Breaks around |
|---|---|---|
| Reading chapters / browsing | thousands of concurrent readers | limited mainly by database connections, not the app |
| Live chat | ~100–200 concurrent connected users | ~500 realtime connections (free plan cap) |
| Talk to Watcher | ~5–15 messages/second across all users | AI provider rate limits (429s) — you already surface these |
| Database rows | free tier: 500 MB ≈ hundreds of thousands of messages/comments | vector embeddings are the space hog, not text |
| Requests/second | edge functions handle hundreds/sec | slow endpoints (Watcher) hold connections open and cause queueing |

Millisecond-level throughput is not a useful measure here: the limit is time-per-request, not raw request count. Fast paths respond in tens of milliseconds; the Watcher takes seconds because of the oversized prompt.

## Plan — free fixes, in priority order

**1. Fix the Watcher prompt (biggest win, zero cost)**
- Stop injecting the full chapter corpus. Rely on retrieval: raise `match_count` from 8 to ~12 and also index chapter text into the same knowledge store so retrieval covers it.
- Cap total context sent per request and trim conversation history to the last 8 messages instead of 20.
- Expected effect: 5–20x cheaper and faster answers, far higher concurrent capacity.

**2. Add per-user rate limiting on Watcher and chat**
- Simple in-memory + database-backed throttle (e.g. 10 Watcher messages/minute, 20 chat messages/minute per user), with a friendly in-character refusal message.
- Prevents one user or a bot from exhausting AI credits for everyone.

**3. Paginate and cache the heavy reads**
- Chat: load the newest 50 messages, "load older" on scroll.
- Chapters list: paginate at 20 and cache the rating aggregates.
- Set sensible cache times in the data layer so repeat visits don't re-query.

**4. Database indexes and cleanup**
- Add indexes on `chat_messages(room_id, created_at)`, `comments(chapter_id)`, `chapter_ratings(chapter_id)`, `profiles(username)`.
- Keeps queries fast as tables grow past 100k rows.

**5. Cache chapter pages at the edge**
- Published chapters are public and rarely change — serve them with short-lived edge caching so readers never touch the database.

**6. Visible limits and graceful degradation**
- Show "The Watcher is resting" instead of an error on rate limits, keep chat usable when the AI is down, and add a small status line so you can see load.

**7. "Use my own keys" for the Watcher (new)**
- Add a small "Use my own API keys" button in the Watcher page header, next to the voice picker. It opens a dialog with two optional fields: an AI key (Google Gemini or OpenAI) and an ElevenLabs key, plus Save / Clear and a "these never leave your device" note.
- Keys are stored only in the browser's local storage on that device — never written to the database, never logged, never attached to the account. Clearing them removes them instantly.
- When a user has their own keys, their chat and voice requests are processed with those keys instead of the site's shared credits. Everything else stays identical: same Watcher persona, same lore, same knowledge library, same retrieved passages, same voices. Only the processing and billing change.
- Retrieval/embedding still runs on the site's side (that's your private knowledge, not the user's), so answers stay grounded in your novel regardless of whose key is used.
- A small badge on the page shows "Using your key" so the reader knows which mode they're in, and clear errors if their key is invalid or out of quota — with automatic fallback to the site key only if you want it (default: show the error, don't silently spend your credits).
- This is the single best free scaling lever: heavy users pay for their own AI and voice usage, so your shared quota lasts far longer.

## Tools used (all free / already included)

- Edge hosting + auto-scaling: included with your project.
- Managed Postgres, auth, storage, realtime: Lovable Cloud free tier (500 MB DB, 1 GB storage, ~500 realtime connections, 2 GB bandwidth).
- AI chat + embeddings: Lovable AI gateway (free monthly allowance, then pay-as-you-go).
- Caching and pagination: built into the existing data layer — no new dependency.

## Paid upgrades for later expansion

| When you need | Upgrade | Rough cost |
|---|---|---|
| More than 500 MB data or 500 chat connections | Cloud Pro tier (8 GB DB, 500k realtime messages) | ~$25/mo |
| Heavy Watcher usage | AI credits top-up, or a cheaper model for short answers | usage-based |
| Voice at scale | ElevenLabs paid tier (free tier is ~10k characters/month) | from ~$5/mo |
| Global speed + DDoS protection | Cloudflare Pro / paid CDN caching | ~$20/mo |
| Knowing about problems before users tell you | Sentry (error tracking) — has a usable free tier too | free–$26/mo |
| Very large chat volume | Move chat history to a partitioned table or dedicated realtime service | usage-based |

## Technical notes

- No schema changes required except new indexes (plus an optional `rate_limits` table for throttling).
- BYO keys: the key is read from local storage in the browser and sent per-request over HTTPS to `/api/watcher/chat` and `/api/watcher/tts`, used once for that call, and discarded. No storage, no logging, no persistence server-side. Requests carrying a user key skip the shared rate limit but keep input validation.
- Watcher chapter grounding moves from prompt-stuffing to the existing `match_watcher_chunks` vector search, so answers stay accurate while the prompt shrinks.
- Embeddings are 3072-dimension vectors — roughly 12 KB per chunk. That's the main driver of database growth; chapter text itself is negligible.
- All changes are backend/config level; the reading, chat and Watcher UI stay exactly as they look now.
