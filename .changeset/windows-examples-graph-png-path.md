---
---

fix(examples): use `fileURLToPath` for the `createAgent` graph PNG output path so it works on Windows.

Only touches files under `examples/`, which is a private, unpublished package (ignored by changesets), so no package version bump is intended.
