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

function injectBackToSpecLink(version, outputHtmlPath) {
  if (!fs.existsSync(outputHtmlPath)) {
    return;
  }

  const html = fs.readFileSync(outputHtmlPath, "utf8");
  const href = `/ocpi/${version}/index.html`;
  const marker = 'id="ocpi-back-to-spec"';

  if (html.includes(marker)) {
    return;
  }

  const backLink = `
<style>
  .ocpi-back-to-spec {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483647;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid #0f172a;
    background: #0f172a;
    color: #ffffff;
    font-family: Arial, sans-serif;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  .ocpi-back-to-spec:hover,
  .ocpi-back-to-spec:focus {
    background: #1e293b;
    border-color: #1e293b;
    color: #ffffff;
    text-decoration: none;
  }

  @media (max-width: 768px) {
    .ocpi-back-to-spec {
      top: 8px;
      right: 8px;
      padding: 8px 10px;
      font-size: 12px;
    }
  }
</style>
<a id="ocpi-back-to-spec" class="ocpi-back-to-spec" href="${href}">Back to specification</a>
`;

  if (html.includes("</body>")) {
    fs.writeFileSync(outputHtmlPath, html.replace("</body>", `${backLink}\n</body>`), "utf8");
    return;
  }

  fs.writeFileSync(outputHtmlPath, `${html}${backLink}`, "utf8");
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
    injectBackToSpecLink(version, outHtmlPath);
  }

  writeFile(path.join(PUBLIC_API_DIR, "index.html"), generateApiIndexHtml(versions));
  console.log("Built API index: public/api/index.html");
}

main();
