# Fix chapter navigation and frozen reader

## Goal
Make tapping an uploaded or published chapter reliably replace the current screen with the chapter reader, including the full written content and translation controls.

## Verified issue
The preview requests for published chapters are failing with `permission denied for function has_role`. The public chapters policy currently calls `has_role(...)` inside its published-content check, so the chapter list and the reader’s route data cannot load even though the URL changes. The database contains published chapters with content, and the reader route already contains the full-text and translation UI.

## Work
1. Repair the chapters read policies so public readers can fetch published chapters using only `published_at IS NOT NULL`, without requiring an admin role-check function.
2. Keep draft and management access protected by a separate authenticated admin policy, using the existing server-side role validation and explicit table permissions.
3. Update the chapter route’s initial data loading to handle query errors visibly instead of leaving the previous screen in place, while preserving the existing reader, bookmarks, comments, ratings, and translation behavior.
4. Verify the full flow from the home/latest-chapter card and the admin chapter list: tap a chapter, confirm the URL changes, confirm the reader title and written paragraphs appear, and confirm the translation selector is present.
5. Check the preview build and browser/runtime logs for any remaining errors.

## Technical details
- Use a database migration for policy and permission changes; do not expose admin-only functions to anonymous readers.
- Keep navigation type-safe with the existing `/chapters/$slug` links.
- Add route-specific error/not-found handling so missing or inaccessible chapters show a clear reader state rather than a frozen view.
