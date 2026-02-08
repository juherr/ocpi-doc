# Plan: Add a Repository to the Library Section

This checklist is used to add community OCPI libraries to the versioned Antora pages.

## Goal

For each OCPI version page, maintain a `Library` section between `Spec` and `About`, grouped by technology.

## Data Rules

- Public site text stays in English.
- Library entries are version-specific.
- Do not display push dates.
- Display `Activity` as:
  - `Active` if the repository `pushed_at` is within the last 365 days.
  - `Inactive` if older than 365 days.
- Active entries are grouped by technology.
- Inactive entries are grouped in an `Inactive Libraries` section with a `Language` column.
- Do not show a separate `Version status` column on public pages.
- If status is `Planned` or `Partial`, surface it as a warning prefix in `Notes`.

## Inputs Required per Repository

1. Repository URL (for example, `https://github.com/org/repo`).
2. OCPI version page target (for example, `2.1.1`).
3. Technology label (for example, `C#`, `Java`, `Python`, `TypeScript`).
4. Internal support status for that page version (for example, `Supported`, `Planned`, `Partial`).
5. One short notes sentence.

## Step-by-Step Workflow

1. Fetch repository metadata:

   ```bash
   gh api repos/<org>/<repo>
   ```

2. Determine `Activity`:
   - Compare `pushed_at` with current date.
   - If older than 365 days, use `Inactive`; otherwise `Active`.
   - Do not expose dates in generated pages.

3. Verify support status from project documentation (README/docs/issues) only for the target OCPI version.

4. Update `tools/generate-antora-components.js`:
   - Add or update the entry under `LIBRARIES_BY_VERSION["<version>"]`.
    - Ensure fields are set: `technology`, `name`, `url`, `versionStatus`, `activity`, `notes`.
    - Keep `versionStatus` for warning generation (`Planned` / `Partial`) even though it is not rendered as a column.

5. Regenerate Antora components:

   ```bash
   npm run generate:antora
   ```

6. Validate output for the target version:
   - `antora/components/ocpi-<version>/modules/ROOT/pages/library.adoc`
   - `antora/components/ocpi-<version>/modules/ROOT/nav.adoc`

7. Optional full site check:

   ```bash
   npm run build:antora
   ```

8. If navigation or workflow behavior changed, update `README.md` and `AGENTS.md`.

## Entry Template

Use this object shape in `LIBRARIES_BY_VERSION`:

```js
{
  technology: 'C#',
  name: 'org/repo',
  url: 'https://github.com/org/repo',
  versionStatus: 'Planned',
  activity: 'Active',
  notes: 'Short factual sentence about the project.',
}
```
