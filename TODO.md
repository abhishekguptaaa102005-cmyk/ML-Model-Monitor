# TODO
- [x] Patch root package.json to remove/replace the failing `preinstall` script that calls `sh` on Windows.
- [ ] Re-run `pnpm install` to confirm dependencies install cleanly (may require approving ignored build scripts).
- [ ] Run `pnpm -r typecheck` (or `pnpm run typecheck`) to ensure builds/tests pass.


