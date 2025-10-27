DB migration / immediate fix instructions

This repository changed `prisma/schema.prisma` to mark `PinnedMessage.snapshotContent` as LONGTEXT.
If you are seeing `Invalid prisma.pinnedMessage.create() invocation: The provided value for the column is too long for the column's type. Column: snapshotContent`, apply one of the following fixes.

Option A — Quick immediate SQL (recommended for urgent fix)
1. Backup your DB.
2. Run the provided ALTER SQL file (MySQL):

```powershell
# from project root (PowerShell)
# Adjust host/user/dbname as needed
mysql -h <HOST> -u <USER> -p <DATABASE> < prisma/sql/0001_make_snapshot_longtext.sql
```

3. Restart the application (Docker/PM2/systemd) and re-run the failing `/pin add` command.

Option B — Prisma migration (preferred for tracked changes)
1. On a development machine where you can run Prisma CLI and connect to the database, generate a migration:

```powershell
# create migration SQL locally (dev)
npx prisma migrate dev --name make-pinned-snapshot-longtext
npx prisma generate
```

2. Commit the generated migration under `prisma/migrations/` and deploy to production using `npx prisma migrate deploy` on the production environment.
3. Regenerate Prisma Client on prod: `npx prisma generate`.

Notes & Safety
- Always backup the DB before ALTER TABLE operations.
- If your production DB is hosted with restricted permissions, coordinate with the DBA to run the ALTER.
- The included SQL file shows pre/post checks (SELECT from INFORMATION_SCHEMA) so you can verify the change.

If you want, I can also:
- create a full Prisma migration directory structure (but you'll need to run `npx prisma migrate deploy` in prod), or
- craft a small rollback SQL if you need one before applying the change.

Which option do you want to take now? If you'll run the SQL, run it and paste the output (or errors) here and I'll validate.
