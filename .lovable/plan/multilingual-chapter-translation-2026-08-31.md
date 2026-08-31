# Multilingual Chapter Translation

## Goal

Add a translation control to every chapter reader so a reader can choose a language and read the complete chapter in that language. English remains the canonical version and can be restored at any time.

## User experience

- Add a compact language selector in the chapter reading header, with English selected by default.
- On selecting a supported language, load the shared cached translation when it exists.
- If it does not exist, show a clear translating state, generate it once, save it, and then display it to the reader.
- Replace the chapter title, summary, and paragraph text together so the reading experience is consistent; preserve paragraph breaks and paragraph-level bookmark positions.
- Keep chapter actions, ratings, comments, and bookmarks working against the canonical chapter and paragraph indexes regardless of the selected language.
- Show a small “AI translation” notice and a “View English” action. Surface actionable errors and preserve the selected language when a request fails.
- Support Urdu’s right-to-left reading direction without changing the rest of the page layout.

## Launch language catalog

The selector will group languages for scanning and use stable locale codes:

- Indian: Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Odia, and Assamese.
- European: French, German, Italian, Spanish, Portuguese, and Russian.
- East Asian: Simplified Chinese (Mandarin), Japanese, and Korean.

English will remain the source language. The catalog will live in a shared typed module so the reader UI, translation service, and admin review UI cannot drift.

## Accuracy and translation design

- Use the project’s Lovable AI Gateway on the server with the enforced default model `openai/gpt-5.6-sol` through the Responses API.
- Use a translation-specific system prompt that requires natural target-language grammar, faithful meaning, literary tone, culturally appropriate punctuation, preservation of names/terms, and no invented or omitted story details.
- Send the chapter in numbered paragraph units and require the model to return the same units, allowing the app to validate count/order before saving. If validation fails, do not cache the result; show a retryable error.
- For long chapters, translate bounded paragraph batches while carrying a short terminology/glossary context forward, then reassemble the validated paragraphs. This avoids oversized requests while preserving names and recurring terms.
- Store the source chapter version/hash with each translation. If the author edits a chapter, older translations become stale and are regenerated rather than shown as current.
- Use bounded retries only for rate limits and transient 5xx responses. Terminal gateway errors are surfaced directly in the UI, including credit/configuration failures.

## Shared cache and backend

- Add a `chapter_translations` table keyed by `(chapter_id, language_code)` with the translated title, summary, paragraph content, source content hash, status, model identifier, timestamps, and optional admin review metadata.
- Add the required grants, RLS, uniqueness constraint, and indexes in one database migration. Public readers may select translations only for published chapters; writes remain server-controlled and validate the source chapter before caching.
- Add server-side translation functions for fetching a cached translation and generating/upserting a missing or stale translation. Validate chapter id, language code, publication status, content size, and translation output before any write.
- Add a short-lived per-IP rate limit and an in-flight/cache check so many readers requesting the same language do not create duplicate AI jobs. Failed generations must not leave a misleading “ready” row.
- Do not store reader API keys or expose the gateway key. Translation generation uses the site’s server-side AI configuration.

## Admin review and maintenance

- Add a translation management area to the existing Scriptorium, showing languages generated per chapter, ready/stale/failed status, timestamps, and the source version.
- Let the author open a translation, edit its title/summary/content, mark it reviewed, regenerate it, or delete it. Reviewed translations remain shared until the author changes or regenerates them.
- Add a chapter-level action to regenerate stale translations after publishing edits, without changing the original English chapter.

## Technical implementation

1. Create the shared language catalog and translation types.
2. Add the database migration for cached translations, grants, RLS, uniqueness, and lookup indexes.
3. Add the server-side Responses API translation flow, validation, chunk assembly, cache handling, rate limiting, and gateway error semantics.
4. Update the chapter route to select/render translated title, summary, and paragraphs while keeping canonical bookmark/comment/rating indexes stable.
5. Add the admin translation review screen and route links using the existing admin layout and design-system components.
6. Add route metadata for the chapter page’s language behavior without changing its canonical English URL.
7. Verify with build/type checks plus browser checks for English, a cached translation, first-generation loading/success, Urdu RTL, error handling, and restored English.

## Acceptance criteria

- A reader can select any launch language from a chapter page and see the whole chapter translated, not only a preview.
- The same chapter/language is generated once and reused by subsequent readers.
- The translation cannot silently replace, reorder, or drop paragraphs; invalid AI output is rejected.
- Original English, ratings, comments, chapter bookmarks, and line bookmarks remain available and functional.
- The author can inspect, edit, regenerate, mark reviewed, and remove cached translations.
- No private AI credentials reach the browser or database, and no unrelated security findings or features are changed.