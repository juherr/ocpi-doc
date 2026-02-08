// tools/sync-asciidoc-to-antora.js
// Mirror root *.asciidoc into Antora's component catalog (partials) and generate wrapper pages.
//
// Why:
// Antora only allows includes to resolve to files that are part of its content catalog.
// Putting files under docs/_src doesn't help. Put them under modules/ROOT/partials instead.
//
// Result:
// - Mirrored sources: docs/modules/ROOT/partials/src/*.adoc
// - Wrapper pages:    docs/modules/ROOT/pages/spec/*.adoc including partial$src/<name>.adoc
// - Images:           docs/modules/ROOT/images/*
// - Examples:         docs/modules/ROOT/attachments/examples/*
//
// Usage:
//   node tools/sync-asciidoc-to-antora.js

const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();

// Antora target paths
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const MODULE_ROOT = path.join(DOCS_DIR, "modules", "ROOT");
const PAGES_DIR = path.join(MODULE_ROOT, "pages");
const SPEC_PAGES_DIR = path.join(PAGES_DIR, "spec");
const PARTIALS_DIR = path.join(MODULE_ROOT, "partials");
const PARTIALS_SRC_DIR = path.join(PARTIALS_DIR, "src");
const ATTACHMENTS_DIR = path.join(MODULE_ROOT, "attachments");
const IMAGES_DIR = path.join(MODULE_ROOT, "images");
const EXAMPLES_ATTACH_DIR = path.join(ATTACHMENTS_DIR, "examples");

// Source paths
const SRC_IMAGES_DIR = path.join(ROOT_DIR, "images");
const SRC_EXAMPLES_DIR = path.join(ROOT_DIR, "examples");

// Files to ignore
const IGNORE_ASCIIDOC = new Set(["pdf_layout.asciidoc"]);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeText(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function copyDirRecursive(src, dest) {
  if (!fileExists(src)) return;
  ensureDir(dest);

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function listRootAsciidocFiles() {
  return fs
    .readdirSync(ROOT_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".asciidoc") && !IGNORE_ASCIIDOC.has(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

function titleFromFilename(fileName) {
  const base = fileName.replace(/\.asciidoc$/, "");
  const clean = base.replace(/^mod_/, "").replace(/[_-]+/g, " ").trim();
  return clean
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toAdocName(fileName) {
  // Mirror to .adoc so Antora partial$ works naturally
  return fileName.replace(/\.asciidoc$/, ".adoc");
}

function wrapperTargetName(fileName) {
  return fileName.replace(/\.asciidoc$/, ".adoc");
}

function ensureAntoraSkeleton() {
  ensureDir(SPEC_PAGES_DIR);
  ensureDir(PARTIALS_SRC_DIR);
  ensureDir(IMAGES_DIR);
  ensureDir(EXAMPLES_ATTACH_DIR);

  const antoraYml = path.join(DOCS_DIR, "antora.yml");
  if (!fileExists(antoraYml)) {
    writeText(
      antoraYml,
      `name: ocpi
title: OCPI
version: latest
nav:
  - modules/ROOT/nav.adoc
`
    );
  }

  const indexPage = path.join(PAGES_DIR, "index.adoc");
  if (!fileExists(indexPage)) {
    writeText(
      indexPage,
      `= OCPI Specifications

This site publishes OCPI specifications and related assets.
`
    );
  }

  const versionsDir = path.join(PAGES_DIR, "versions");
  ensureDir(versionsDir);

  const versionsIndex = path.join(versionsDir, "index.adoc");
  if (!fileExists(versionsIndex)) {
    writeText(
      versionsIndex,
      `= Versions

This section can link to Swagger UI/ReDoc per OCPI version.
`
    );
  }

  const navFile = path.join(MODULE_ROOT, "nav.adoc");
  if (!fileExists(navFile)) {
    writeText(
      navFile,
      `* xref:index.adoc[Home]
* xref:versions/index.adoc[Versions]
* Spec
`
    );
  }
}

function upsertNavEntries(wrapperPages) {
  const navFile = path.join(MODULE_ROOT, "nav.adoc");
  const existing = fileExists(navFile) ? readText(navFile) : "";

  const marker = "* Spec";
  const idx = existing.indexOf(marker);
  const header = idx >= 0 ? existing.slice(0, idx + marker.length) : `* xref:index.adoc[Home]\n* Spec`;

  const lines = wrapperPages.map((p) => `** xref:spec/${p.wrapperFile}[${p.title}]`);
  const newNav = `${header}\n${lines.join("\n")}\n`;

  writeText(navFile, newNav);
}

function mirrorSourcesIntoPartials(asciidocFiles) {
  for (const fileName of asciidocFiles) {
    const src = path.join(ROOT_DIR, fileName);
    const dest = path.join(PARTIALS_SRC_DIR, toAdocName(fileName));
    fs.copyFileSync(src, dest);
  }
}

function generateWrappers(asciidocFiles) {
  const wrapperPages = [];

  for (const fileName of asciidocFiles) {
    const wrapperFile = wrapperTargetName(fileName);
    const wrapperAbs = path.join(SPEC_PAGES_DIR, wrapperFile);
    const title = titleFromFilename(fileName);

    const partialName = toAdocName(fileName);

    const content = `= ${title}
:page-editable: false

// Wrapper page generated by tools/sync-asciidoc-to-antora.js
include::partial$src/${partialName}[]
`;

    writeText(wrapperAbs, content);
    wrapperPages.push({ wrapperFile, title });
  }

  return wrapperPages;
}

function syncAssetsIntoAntora() {
  copyDirRecursive(SRC_IMAGES_DIR, IMAGES_DIR);
  copyDirRecursive(SRC_EXAMPLES_DIR, EXAMPLES_ATTACH_DIR);
}

function main() {
  ensureAntoraSkeleton();

  const asciidocFiles = listRootAsciidocFiles();
  if (!asciidocFiles.length) {
    console.error("ERROR: No root *.asciidoc files found to sync.");
    process.exit(1);
  }

  mirrorSourcesIntoPartials(asciidocFiles);
  const wrapperPages = generateWrappers(asciidocFiles);
  syncAssetsIntoAntora();
  upsertNavEntries(wrapperPages);

  console.log(`✔ Mirrored ${asciidocFiles.length} files into: ${path.relative(ROOT_DIR, PARTIALS_SRC_DIR)}`);
  console.log(`✔ Generated ${wrapperPages.length} wrapper pages into: ${path.relative(ROOT_DIR, SPEC_PAGES_DIR)}`);
  console.log(`✔ Synced images into: ${path.relative(ROOT_DIR, IMAGES_DIR)}`);
  console.log(`✔ Synced examples into: ${path.relative(ROOT_DIR, EXAMPLES_ATTACH_DIR)}`);
  console.log("\nNext steps:\n  npx antora antora-playbook.yml");
}

main();

