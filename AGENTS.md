# Project Versioning, Watermark & Git Commit Rules

Follow these rules whenever making any code, UI, asset, or configuration alteration in this repository:

1. **Increment Project Version & Watermark Before Committing**:
   - Before creating a commit for any alteration, increment the minor integer part of the version string `0.<N>` to `0.<N+1>` (for example: `0.1` -> `0.2`, `0.9` -> `0.10`, `0.99` -> `0.100`). Never roll over the major version to `1.0` automatically.
   - Update the version across all locations so the in-app watermark and metadata stay synchronized:
     - `index.html`: Update `<title>Pedro's Guitar Hub v<version></title>`.
     - `index.html`: Update the footer watermark `<p class="version-watermark">v<version></p>`.
     - `README.md` (if present): Update any version label or badge to `v<version>`.

2. **Automatic Local Commit for Rollback Safety**:
   - Stage and create a local Git commit after completing each alteration so the project always has a clean rollback point.
   - Format the commit message following the repository standard:
     `<version> <concise lowercase summary of changes>`
     *(Example: `0.2 update tuner algorithm, fix metronome audio context and add watermark`)*

3. **Never Push Without Explicit Approval**:
   - **Never** run `git push` automatically.
   - Only push to the remote repository when the user explicitly asks to push.
