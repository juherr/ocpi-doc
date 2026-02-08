const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = process.cwd();
const OPENAPI_ROOT_DIR = path.join(ROOT_DIR, "openapi");
const PUBLIC_API_DIR = path.join(ROOT_DIR, "public", "api");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function listOpenApiVersions() {
  if (!fs.existsSync(OPENAPI_ROOT_DIR)) {
    return [];
  }

  return fs
    .readdirSync(OPENAPI_ROOT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ocpi-"))
    .map((entry) => ({
      version: entry.name.replace(/^ocpi-/, ""),
      rootSpec: path.join(OPENAPI_ROOT_DIR, entry.name, "openapi.yaml"),
    }))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
}

function runNodeScript(scriptName, args) {
  execFileSync(process.execPath, [path.join("tools", scriptName), ...args], {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
}

function buildRedoc(version, inputSpecPath, outputHtmlPath) {
  execFileSync(
    "npx",
    ["--yes", "@redocly/cli", "build-docs", inputSpecPath, "--output", outputHtmlPath],
    { cwd: ROOT_DIR, stdio: "inherit" }
  );
  console.log(`Built Redoc page: public/api/${version}/index.html`);
}

function generateApiIndexHtml(versions) {
  const latest = versions[0];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Reference</title>
  <meta http-equiv="refresh" content="0; url=./${latest.version}/" />
  <link rel="canonical" href="./${latest.version}/" />
</head>
<body>
  <p>Redirecting to latest API version: <a href="./${latest.version}/">OCPI ${latest.version}</a></p>
</body>
</html>
`;
}

function main() {
  const versions = listOpenApiVersions();

  if (!versions.length) {
    console.error("ERROR: no OpenAPI sources found under openapi/ocpi-*");
    process.exit(1);
  }

  if (fs.existsSync(PUBLIC_API_DIR)) {
    fs.rmSync(PUBLIC_API_DIR, { recursive: true, force: true });
  }
  ensureDir(PUBLIC_API_DIR);

  for (const { version, rootSpec } of versions) {
    runNodeScript("generate-root-openapi.js", [version]);
    const outVersionDir = path.join(PUBLIC_API_DIR, version);
    const outHtmlPath = path.join(outVersionDir, "index.html");

    if (fs.existsSync(outVersionDir)) {
      fs.rmSync(outVersionDir, { recursive: true, force: true });
    }
    ensureDir(outVersionDir);

    buildRedoc(version, rootSpec, outHtmlPath);
  }

  writeFile(path.join(PUBLIC_API_DIR, "index.html"), generateApiIndexHtml(versions));
  console.log("Built API index: public/api/index.html");
}

main();
