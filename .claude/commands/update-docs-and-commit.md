Before committing, update the project documentation to reflect the current state of the codebase:

1. **docs/changelog.md** — Add an entry for today's date (or append to today's existing entry) describing what changed. Use the format already in the file (### Added, ### Changed, ### Fixed, ### Database, etc.).

2. **docs/project_status.md** — Update the milestones table (mark items Done/In Progress/Not Started as appropriate), update "What's Been Accomplished" with any new work, and update "What's Next" to reflect the current priorities.

3. **docs/architecture.md** — Only update if there are structural changes (new components, new tables, new services, changed data flow, or key decisions resolved).

4. **docs/schema.sql** — Only update if the database schema changed.

5. **project_spec.md** — Only update if requirements, API specs, or tech decisions were finalized.

After updating the relevant docs, stage all changed files and create a commit. Use a clear commit message describing the code changes (not the doc updates). Follow the git commit instructions from the system prompt.

$ARGUMENTS