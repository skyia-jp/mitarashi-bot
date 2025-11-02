Release procedure for shiro-bot

This document describes a safe release process after the package name change and TypeScript migrations.

Checklist (local)

1. Update branch from main and create a PR branch.
2. Run typecheck and lint locally:

```powershell
npx tsc -p tsconfig.json --noEmit
npm run lint
```

3. Run the deploy script in dry-run mode to preview Slash command changes (no destructive deletes):

```powershell
$env:DRY_RUN="true"; $env:ALLOW_DELETE_OLD="false"; bun scripts/deploy-commands.ts
```

4. If dry-run output looks good, open a PR and wait for CI (GitHub Actions) to pass.

Deployment (after PR merge)

1. Merge PR to `main`.
2. Tag a release, e.g. `git tag -a vX.Y.Z -m "release"` and push tag.
3. Run real deploy (first with caution):

```powershell
$env:DRY_RUN="false"; $env:ALLOW_DELETE_OLD="false"; bun scripts/deploy-commands.ts
# If you're confident deletions are intended, set ALLOW_DELETE_OLD=true
$env:DRY_RUN="false"; $env:ALLOW_DELETE_OLD="true"; bun scripts/deploy-commands.ts
```

Notes
- Keep `ALLOW_DELETE_OLD=false` by default. Only allow deletions when you have verified the intended commands in dry-run.
- If running under Node (not Bun), use `node --loader ts-node/esm scripts/deploy-commands.ts` but ensure `ts-node` is installed (devDependencies).
