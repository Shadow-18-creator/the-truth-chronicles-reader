# The Boy Who Saw The Truth

A serialized-novel reading community with chapter discussions, bookmarks, translations, reader profiles, and two story companions. The Keeper is available to readers and uses published-story context; the Watcher is reserved for the author and supports drafting against private lore.

## Architecture

- **Web app:** React 19 and TanStack Start/Router, with TypeScript and Vite.
- **Data and identity:** Lovable Cloud, backed by a database and authentication; access rules separate public reading from author-only lore and training.
- **AI and voice:** server-side AI and public-web research integrations; optional ElevenLabs voice for The Keeper.
- **Tests:** Vitest runs unit tests, while React Testing Library exercises UI interactions in jsdom. External APIs and auth are mocked so tests do not require live credentials.

## Install

```sh
npm install
```

## Testing

Run the complete automated suite:

```sh
npm test
```

Tests live in `src/__tests__/`. They cover shared formatting and policy helpers, Watcher prompt/request handling, the optional public research boundary, and representative Scriptorium interactions and API states.

## Development

```sh
npm run dev
```
