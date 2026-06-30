# Project Agent Notes

## Environment

- Do not assume optional command-line tools are installed. Check availability before using them.
- In Codex Desktop, `node` may not be available on the system `PATH`. Use the bundled workspace Node reported by the runtime/dependency helper for validation scripts such as `scripts/validate-static.mjs`.
- The GitHub CLI (`gh`) is optional and may be unavailable. For direct updates to `main`, use normal `git` commands. Only ask to install `gh` when the task specifically needs pull requests, GitHub Actions inspection, or GitHub metadata that plain `git` cannot provide.
- Prefer existing repository scripts and document any missing external dependency instead of silently assuming it exists.
