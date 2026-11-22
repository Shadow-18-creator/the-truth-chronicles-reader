# TinyFish setup
- [x] Save TinyFish key securely for direct server calls.
- [x] Add public-web research to Watcher and Keeper without forwarding drafts, lore, or training data.
- [x] Test privacy boundaries, provider handling, and signed-in assistant flows.
- [x] Let unsigned readers chat with The Keeper and hear Keeper replies, while keeping daily limits and published-story-only access.

# Automated testing and code modularity
- [x] Add Vitest, React Testing Library, jsdom, and a `test` script.
- [x] Add focused unit and UI workflow tests for shared helpers and Watcher behavior.
- [x] Extract testable Watcher prompt and request-validation logic.
- [x] Document the testing command and architecture in README.
- [ ] Run tests and validate typecheck/build; commit the finished change.

# Profile image persistence
- [ ] Trace upload, profile database update, and read/display flow for uploaded and generated avatars.
- [ ] Fix verified persistence/display issue and add focused regression coverage.
- [ ] Verify saved avatar readback through the profile UI and commit all completed changes.