# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Repository Goal (ocpi.fyi)

This repository is used to build a multi-version Antora documentation site for OCPI.

Primary objectives:
- Mirror official OCPI sources from `https://github.com/ocpi/ocpi`.
- Keep one directory per version under `specifications/`:
  - `specifications/ocpi-2.3.0`
  - `specifications/ocpi-2.2.1`
  - etc.
- Preserve Git history for each imported version to support future resync with upstream.
- Generate a multi-version Antora site publishable to GitHub Pages.
- Target public domain: `ocpi.fyi`.

Maintenance reminder:
- Keep `AGENTS.md` and `README.md` updated whenever behavior, build commands, navigation, or project workflows change.

## Antora + API Explorer Integration Notes

- OpenAPI source directories are versioned under `openapi/ocpi-x.y.z`.
- `npm run build:redoc` generates one Redoc page per version in `public/api/<version>/index.html`.
- `npm run build:openapi-diff` generates OpenAPI comparison pages under `public/api/<version>/diff/` for configured baselines.
- `npm run build:swagger` generates one Swagger UI page per version in `public/api/<version>/swagger/index.html`.
- `npm run build:search` generates a Pagefind static index under `public/pagefind/`.
- Pagefind indexing is limited to `/ocpi/**/*.html` (spec pages only); `/api/` pages are intentionally excluded.
- If `/ocpi/latest/` pages exist, they are excluded from Pagefind indexing to avoid duplicate results.
- Pagefind indexing excludes boilerplate content such as `Edit this Page` and module header boilerplate.
- Search results include an OCPI version badge and a version filter in the search popup.
- `/api/` must point to the latest version (generated as a redirect page).
- The public website is English-only; navigation labels and generated UI text must stay in English.
- Antora version navigation includes `Home`, `Spec`, `Library`, `Services`, `API Diff`, `Community`, `Sponsor`, and `About`.
- Library entries are version-specific.
- Active projects are grouped by technology.
- Inactive projects are listed in an `Inactive Libraries` section with a `Language` column.
- Planned/Partial support is displayed as a warning inside the `Notes` column.
- Do not display last push dates on public pages.
- Services entries are generated from `data/services.csv` and grouped by category.
- Services pages must display a non-exhaustive disclaimer, contact call-to-action, and sponsor highlight note.
- Use `ai/PLAN-services-catalog-workflow.md` when adding or updating service entries from URLs.
- Each generated Redoc page should expose a visible `Back to specification` link pointing to `/ocpi/<version>/index.html`.
- Each generated Swagger UI page should expose a visible `Back to specification` link pointing to `/ocpi/<version>/index.html`.
- When customizing the Antora navbar, keep the full default `<header class="header">...` structure in `antora/supplemental-ui/partials/header-content.hbs`.
- For a working hover dropdown in the default UI, keep the dropdown trigger `href="#"` and place real links inside `.navbar-dropdown`.
- Keep search UI text in English (for example, placeholder `Search the docs`).

## Source Import and Sync Strategy

Use `git subtree` to import and maintain each OCPI version branch, preserving history.

Expected upstream remote:
- `upstream` -> `https://github.com/ocpi/ocpi.git`

Initial import pattern:
```bash
git remote add upstream https://github.com/ocpi/ocpi.git
git fetch upstream
git subtree add --prefix specifications/ocpi-2.3.0 upstream release-2.3.0-bugfixes
git subtree add --prefix specifications/ocpi-2.2.1 upstream release-2.2.1-bugfixes
git subtree add --prefix specifications/ocpi-2.2.0 upstream release-2.2-bugfixes
git subtree add --prefix specifications/ocpi-2.1.1 upstream release-2.1.1-bugfixes
```

Resync pattern:
```bash
git fetch upstream
git subtree pull --prefix specifications/ocpi-2.3.0 upstream release-2.3.0-bugfixes
```

Important:
- Do not rewrite subtree history.
- Prefer additive updates to keep imports traceable.
- Keep version directory names aligned with OCPI release labels (`ocpi-x.y.z`).

## Project Overview

This is the **OCPI (Open Charge Point Interface)** specification repository - a protocol for EV charging roaming between Charge Point Operators (CPOs) and e-Mobility Service Providers (eMSPs). The specification is written in AsciiDoc format and published as PDF documents.

**Current version:** 2.3.0-dev (in development)
**Stable versions:** 2.2.1, 2.2, 2.1.1

## Repository Structure

- `*.asciidoc` - Main specification modules (locations, sessions, CDRs, tariffs, tokens, commands, etc.)
- `examples/*.json` - JSON example files referenced in the specification
- `plantuml/` - PlantUML diagram source files
- `images/` - Generated SVG diagrams and other images
- `scripts/` - Build and validation scripts
- `releases/` - Release build configuration and output

### Key Specification Files

- `introduction.asciidoc` - Overview and version history
- `terminology.asciidoc` - Abbreviations and role definitions (CPO, eMSP, NAP, NSP, etc.)
- `transport_and_format.asciidoc` - HTTP/JSON protocol details, authentication
- `credentials.asciidoc` - Registration and security
- `mod_*.asciidoc` - Protocol modules (locations, sessions, CDRs, tariffs, tokens, commands, charging_profiles, hub_client_info, payments)
- `types.asciidoc` - Shared data types
- `changelog.asciidoc` - Version change history

## Building the Specification

All build commands are run from the `releases/` directory:

```bash
cd releases
```

### Full build (recommended)
```bash
make all
```
This runs: copy files → merge → check links & JSON → generate images → create PDF

### Build PDF only
```bash
make make_pdf
```

### Generate PlantUML diagrams to SVG
```bash
make images
```

### Validate JSON examples
```bash
make check_json
```
This validates all JSON files in `examples/` using jsonlint.

### Validate AsciiDoc internal links
```bash
make check_asciidoc
```

### Update diagrams in main repo (without full build)
```bash
make images_current
```

### Clean generated PDF
```bash
make clean
```

## Build Requirements

- `asciidoctor-pdf` - AsciiDoc to PDF converter
- Java - Required for PlantUML
- `jsonlint` - JSON validation (used by `scripts/check_json.sh`)

## Branching Strategy

- `master` - Always contains the latest official release (read-only)
- `develop` - Active development for next major version (requires signed CLA)
- `release-X.X.X-bugfixes` - Bug fixes for specific releases (e.g., `release-2.3.0-bugfixes`, `release-2.2.1-bugfixes`)

**Important:** NEVER create pull requests to `master`. Use the appropriate bugfix branch for fixes or `develop` for new features.

## Contributing

### Bug Fixes and Documentation Improvements
Anyone can contribute editorial fixes, typos, or example corrections WITHOUT signing the CLA:
1. Branch from the appropriate `release-X.X.X-bugfixes` branch
2. Make changes
3. Create pull request to the same bugfix branch

### New Features
Requires signed Contributor License Agreement (CLA) - contact ocpi@nklnederland.nl:
1. Branch from `develop`
2. Make changes
3. Create pull request to `develop`

## Making a Release

From `releases/how_to_make_a_new_release.md`:
1. Edit `releases/Makefile`: Set VERSION to correct version label
2. Edit `pdf_layout.asciidoc`: Set year and revdate
3. Run `make` from releases directory
4. Check resulting PDF for formatting errors
5. Commit and push
6. Create GitHub release at https://github.com/ocpi/ocpi/releases

## Protocol Architecture

OCPI supports three main topologies:
1. **Direct connections** - CPO to eMSP bilateral connections
2. **Hub-based** - Multiple parties connecting through a roaming hub
3. **Hybrid** - Combination of direct and hub connections

### Core Concepts

- **Token-based authentication** - Uses Base64-encoded credentials tokens in HTTP Authorization headers
- **Push and Pull models** - Supports both real-time updates (Push) and periodic polling (Pull)
- **RESTful HTTP/JSON** - All communication uses REST endpoints with JSON payloads
- **Module-based design** - Independent modules can be implemented separately

### Market Roles

- **CPO** - Charge Point Operator (operates charge points)
- **eMSP** - e-Mobility Service Provider (provides charging services to EV drivers)
- **NAP** - National Access Point
- **NSP** - Navigation Service Provider
- **SCSP** - Smart Charging Service Provider
- **PTP** - Payment Terminal Provider
- **PSP** - Payment Service Provider
- **Roaming Hub** - Facilitates multi-party roaming

## File Naming Conventions

- Specification modules: `mod_<module_name>.asciidoc`
- Examples: `<module>_example_<description>.json` or `<module>_<scenario>_example.json`
- Diagrams: PlantUML sources in `plantuml/`, generated SVGs in `images/`

## Documentation Style

- Use AsciiDoc format (not Markdown)
- Follow RFC 2119 requirement keywords (MUST, SHALL, SHOULD, MAY, etc.)
- Include working JSON examples in `examples/` directory
- JSON examples must be valid JSON (validated during build)
- Use PlantUML for diagrams (SVG output, not PNG)
- Follow the structure in `template-object-description.md` for new objects

## Working with Examples

All JSON examples are:
- Stored as separate files in `examples/`
- Validated during build process
- Referenced from AsciiDoc files
- Must be syntactically valid JSON

When modifying examples:
1. Edit the JSON file in `examples/`
2. Run `make check_json` to validate
3. Verify the example is properly referenced in the AsciiDoc files
