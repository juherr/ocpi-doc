# ocpi.fyi

Multi-version Antora documentation site for OCPI specifications.

This repository mirrors official OCPI release branches into versioned folders under `specifications/`, keeps upstream Git history, and publishes a single documentation website with version switching.

## Goals

- Import OCPI versions from `https://github.com/ocpi/ocpi`
- Keep one folder per version: `specifications/ocpi-x.y.z`
- Preserve history for each imported version (for future sync)
- Generate a multi-version Antora site
- Deploy automatically to GitHub Pages
- Serve the site on `ocpi.fyi`

## Upstream Sync Model (git subtree)

Each OCPI release branch is imported with `git subtree`, so commit history remains available inside each `specifications/ocpi-x.y.z` directory.

### Configure upstream

```bash
git remote add upstream https://github.com/ocpi/ocpi.git
git fetch upstream
```

### Initial imports

```bash
git subtree add --prefix specifications/ocpi-2.3.0 upstream release-2.3.0-bugfixes
git subtree add --prefix specifications/ocpi-2.2.1 upstream release-2.2.1-bugfixes
git subtree add --prefix specifications/ocpi-2.2.0 upstream release-2.2-bugfixes
git subtree add --prefix specifications/ocpi-2.1.1 upstream release-2.1.1-bugfixes
```

### Resync an existing version

```bash
git fetch upstream
git subtree pull --prefix specifications/ocpi-2.3.0 upstream release-2.3.0-bugfixes
```

## Target Structure

```text
specifications/
  ocpi-2.3.0/
  ocpi-2.2.1/
  ocpi-2.2.0/
  ocpi-2.1.1/
```

Each version folder is treated as a versioned Antora content source.

## Antora (multi-version)

The Antora playbook references all version folders and renders one site with version navigation.
Each version includes `Home`, `Spec`, `Library`, `API Diff`, `Community`, `Sponsor`, and `About` pages.

### Version status

- `2.3.0`: current release branch
- `2.2.1`: stable maintained release
- `2.2.0`: deprecated, replaced by `2.2.1`
- `2.1.1`: imported from upstream (Markdown-based source)

Typical local build:

```bash
npm install
npm run build:site
```

Generated site output is written to `public/`.

### Site search (Pagefind)

- Search is powered by [Pagefind](https://pagefind.app/).
- Search indexing is intentionally scoped to specification pages under `/ocpi/`.
- API pages under `/api/` are not indexed.
- If a `/ocpi/latest/` alias exists, it is excluded from indexing to avoid duplicate search results.
- Boilerplate UI text (for example `Edit this Page`) and module header boilerplate are excluded from search indexing.
- Search results display a version badge and support filtering by OCPI version in the search popup.

Useful commands:

```bash
npm run build:antora
npm run build:search
```

`npm run build:site` runs the full pipeline (Antora + API pages + search index).

### Library section maintenance

- Library pages are generated per OCPI version.
- Active projects are grouped by technology.
- Inactive projects are listed in a dedicated `Inactive Libraries` section with a `Language` column.
- Planned/Partial support is shown as a warning in the `Notes` column.
- Last push dates are not displayed on public pages.
- Update workflow reference: `ai/PLAN-library-catalog-workflow.md`.

## OpenAPI and API Reference

- OpenAPI sources are stored under `openapi/ocpi-x.y.z`
- Versioned Redoc pages are generated under `public/api/<version>/`
- OpenAPI diff pages are generated under `public/api/<version>/diff/` (for configured baselines)
- Versioned Swagger UI pages are generated under `public/api/<version>/swagger/`
- `/api/` redirects to the latest API version
- Each generated API page exposes `Back to specification` to `/ocpi/<version>/index.html`
- Public navigation labels and generated UI text are kept in English

Typical API build commands:

```bash
npm run build:redoc
npm run build:openapi-diff
npm run build:swagger
```

`npm run build:swagger` auto-detects every `openapi/ocpi-x.y.z/` directory and generates one Swagger UI page per version.

`npm run build:site` builds Antora + Redoc + Swagger UI and then generates the Pagefind index into `public/`.

## Deployment

### GitHub Pages

- Build Antora in CI
- Upload `public/` as Pages artifact
- Deploy with `actions/deploy-pages`

## Notes

- Keep subtree imports additive and traceable.
- Do not rewrite imported subtree history.
- Use OCPI release branch names directly (for example, `release-2.3.0-bugfixes`).

## Maintainer

- Maintained by Julien Herr
- Website: https://juherr.dev/
- Contact: ocpi@juherr.dev
- Source code: https://github.com/juherr/ocpi-doc
