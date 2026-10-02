# Project Architecture Rules

- Keep public Watcher profile reads in a server function using an anonymous publishable-key client and an explicit safe-column projection; keep full training reads and writes behind authenticated admin policies. This prevents public access from inheriting private training fields.