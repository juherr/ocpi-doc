// Generates a root OpenAPI spec (openapi.yaml) by aggregating paths from OCPI module specs.
// Usage:
//   node tools/generate-root-openapi.js 2.3.0
//   OCPI_VERSION=2.3.0 node tools/generate-root-openapi.js
//
// Requirements:
//   npm i -D yaml

const fs = require("fs");
const path = require("path");
let yaml;
try {
  yaml = require("yaml");
} catch (e) {
  console.error("Missing dependency: yaml");
  console.error("Install it with: npm install --save-dev yaml");
  process.exit(1);
}

// ---- Version handling -------------------------------------------------------
const versionArg = process.argv[2];
const VERSION = versionArg || process.env.OCPI_VERSION;

if (!VERSION) {
  console.error("ERROR: OCPI version is required. Example: node tools/generate-root-openapi.js 2.3.0");
  process.exit(1);
}

// ---- Paths ------------------------------------------------------------------
const VERSION_DIR = `openapi-${VERSION}`;
const OUTPUT_FILE = path.join(VERSION_DIR, "openapi.yaml");

// ---- Metadata ---------------------------------------------------------------
const ROOT_INFO = {
  title: `OCPI ${VERSION} API`,
  version: VERSION,
  license: {
    name: "Creative Commons Attribution-NoDerivatives 4.0 International",
    url: "https://creativecommons.org/licenses/by-nd/4.0/",
  },
};

// Optional servers
// const SERVERS = [{ url: "https://api.example.com" }];

// ---- Helpers ----------------------------------------------------------------
function toJsonPointerKey(key) {
  // JSON Pointer escaping: "~" => "~0", "/" => "~1"
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isYamlFile(fileName) {
  return fileName.endsWith(".yaml") || fileName.endsWith(".yml");
}

function isSharedFile(filePath) {
  return filePath.includes(`${path.sep}shared${path.sep}`);
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, "utf8"));
}

function listModuleSpecs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      files.push(...listModuleSpecs(full));
      continue;
    }

    if (e.isFile() && isYamlFile(e.name)) {
      files.push(full);
    }
  }

  return files
    .filter((f) => !f.endsWith(path.sep + "openapi.yaml") && !f.endsWith(path.sep + "openapi.yml"))
    .filter((f) => !isSharedFile(f))
    // keep only top-level module specs (OCPI convention)
    .filter((f) => path.dirname(f) === path.resolve(dir));
}

// ---- Main -------------------------------------------------------------------
function main() {
  const baseDirAbs = path.resolve(VERSION_DIR);

  if (!fs.existsSync(baseDirAbs)) {
    console.error(`ERROR: directory not found: ${VERSION_DIR}`);
    process.exit(1);
  }

  const specFiles = listModuleSpecs(baseDirAbs).sort((a, b) => a.localeCompare(b));

  if (specFiles.length === 0) {
    console.error(`ERROR: no module specs found in ${VERSION_DIR}`);
    process.exit(1);
  }

  const root = {
    openapi: "3.1.0",
    info: ROOT_INFO,
    paths: {},
    // servers: SERVERS,
  };

  const collisions = [];
  let totalPaths = 0;

  for (const filePath of specFiles) {
    const doc = readYaml(filePath);

    if (!doc?.paths) continue;

    const fileName = path.basename(filePath);
    for (const p of Object.keys(doc.paths)) {
      totalPaths++;

      if (root.paths[p]) {
        collisions.push({ path: p, from: fileName });
        continue; // keep first occurrence
      }

      root.paths[p] = {
        $ref: `./${fileName}#/paths/${toJsonPointerKey(p)}`,
      };
    }
  }

  fs.writeFileSync(OUTPUT_FILE, yaml.stringify(root), "utf8");

  console.log(`✔ Generated ${OUTPUT_FILE}`);
  console.log(`  OCPI version: ${VERSION}`);
  console.log(`  Module specs: ${specFiles.length}`);
  console.log(`  Paths found: ${totalPaths}`);
  console.log(`  Paths exported: ${Object.keys(root.paths).length}`);

  if (collisions.length) {
    console.warn(`⚠ Path collisions detected (${collisions.length})`);
    collisions.slice(0, 10).forEach((c) =>
      console.warn(`  - ${c.path} (duplicate in ${c.from})`)
    );
  }

  console.log("\nNext steps:");
  console.log(`  npx @redocly/cli lint ${OUTPUT_FILE}`);
  console.log(`  npx @redocly/cli build-docs ${OUTPUT_FILE} --output dist/redoc/${VERSION}/index.html`);
}

main();

