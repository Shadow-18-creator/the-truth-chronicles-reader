# The Boy Who Saw The Truth

An AI-powered storytelling ecosystem that enables readers to explore serialized novels while helping authors build, manage, and monetize story universes.

## Core Concept

The platform introduces two specialized AI companions:

### The Keeper (Reader AI)
- Answers story-related questions
- Uses only chapters already read by the user
- Prevents spoilers through progression-aware retrieval
- Supports summaries, explanations, and story exploration

### The Watcher (Author AI)
- Private author-only knowledge companion
- Trained using lore documents, character profiles, timelines, research, URLs, and images
- Assists with world-building, drafting, and story consistency

## Key Innovation

```text
Reader → Keeper → Published Story Context

Author → Watcher → Private Lore Knowledge Base
```

This role-based knowledge separation allows spoiler-safe reader interactions while giving authors a dedicated AI workspace.

## Tech Stack

- React 19
- TypeScript
- Vite
- TanStack Router
- Lovable Cloud
- Retrieval-Augmented Generation (RAG)
- ElevenLabs Voice (Optional)
- Vitest & React Testing Library

## Vision

Transform static novels into interactive story universes where readers engage with AI-powered companions and authors manage intelligent knowledge systems around their content.


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
