# Project Versioning, Watermark, Environments & Git Commit Rules

Follow these rules whenever making any code, UI, asset, or configuration alteration in this repository:

1. **Increment Project Version & Watermark Before Committing**:
   - Before creating a commit for any alteration, increment the minor integer part of the version string `0.<N>` to `0.<N+1>` (for example: `0.1` -> `0.2`, `0.9` -> `0.10`, `0.99` -> `0.100`). Never roll over the major version to `1.0` automatically.
   - Update the version across all locations so the in-app watermark and metadata stay synchronized:
     - `index.html`: Update `<title>Pedro's Guitar Hub v<version></title>`.
     - `index.html`: Update `<span class="version-badge">v<version></span>`.
     - `index.html`: Update the footer watermark `<p class="version-watermark">v<version></p>`.
     - `README.md` (if present): Update any version label or badge to `v<version>`.

2. **Branching Strategy & Environments (Vercel & GitHub)**:
   - **`dev` branch (Development / Preview)**:
     - All active development, feature experimentation, and agent alterations occur on `dev`.
     - Pushing `dev` to GitHub triggers an automatic **Vercel Preview Deployment** for testing on mobile and other devices without touching production.
   - **`main` branch (Production)**:
     - Represents stable, released versions deployed automatically to the primary public **Vercel Production** URL.
     - Merges into `main` should only occur when features on `dev` are verified and ready for release.

3. **Automatic Local Commit for Rollback Safety**:
   - Stage and create a local Git commit after completing each alteration so the project always has a clean rollback point.
   - Format the commit message following the repository standard:
     `<version> <concise lowercase summary of changes>`
     *(Example: `0.5 document dev/main branching workflow and update AGENTS.md`)*

4. **Never Push Without Explicit Approval**:
   - **Never** run `git push` automatically.
   - Only push to the remote repository (`dev` or `main`) when the user explicitly asks to push.
