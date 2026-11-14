# Security baseline

- Pair explicitly; issue revocable per-device credentials.
- Authenticate every connection.
- Keep services local-network-only; no public exposure by default.
- Restrict file uploads/downloads to configured directories.
- Canonicalize paths and reject traversal, symlinks outside root and unsafe names.
- Enforce a 100 MiB initial configurable per-file limit while streaming.
- Never auto-open or execute received files.
- Do not log PINs, tokens or file contents.
- Keep keyboard injection in the interactive logged-in Windows session.
