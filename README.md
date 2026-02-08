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
```

Each version folder is treated as a versioned Antora content source.

## Antora (multi-version)

The Antora playbook references all version folders and renders one site with version navigation.

Typical local build:

```bash
npm install
npx antora antora-playbook.yml
```

Generated site output is written to `public/`.

## Deployment

### GitHub Pages

- Build Antora in CI
- Upload `public/` as Pages artifact
- Deploy with `actions/deploy-pages`

## Notes

- Keep subtree imports additive and traceable.
- Do not rewrite imported subtree history.
- Use OCPI release branch names directly (for example, `release-2.3.0-bugfixes`).
