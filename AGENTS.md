# Project Architecture Rules

- Keep public Watcher profile reads in a server function using an anonymous publishable-key client and an explicit safe-column projection; keep full training reads and writes behind authenticated admin policies. This prevents public access from inheriting private training fields.
- Keep The Keeper public for anonymous readers with per-device and per-network safeguards, published-summary-only story context, and public voice replies; keep the Watcher author-only. This lets readers use the companion without exposing private lore or training data.
- TinyFish research uses the direct API from a shared server-only helper after the applicable chat limits; generate generic public topics from only the latest question, never pass drafts, lore, training data or conversation history, and treat web results as untrusted non-canonical evidence. Why: isolates public research from private author material.
