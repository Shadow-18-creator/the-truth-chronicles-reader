# Project Architecture Rules

- Keep public Watcher profile reads in a server function using an anonymous publishable-key client and an explicit safe-column projection; keep full training reads and writes behind authenticated admin policies. This prevents public access from inheriting private training fields.- Public Keeper and author-only Watcher: readers use the Keeper route with its own limits and published-summary context; the Watcher chat route rejects non-admins. Why: keeps private lore out of public answers.
