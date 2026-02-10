const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const { OPENAPI_DIFF_BASELINES } = require('./openapi-diff-config')

const ROOT_DIR = process.cwd()
const OPENAPI_ROOT_DIR = path.join(ROOT_DIR, 'openapi')
const PUBLIC_API_DIR = path.join(ROOT_DIR, 'public', 'api')

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

function runNodeScript(scriptName, args) {
  execFileSync(process.execPath, [path.join('tools', scriptName), ...args], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  })
}

function bundleOpenApiYaml(inputYamlPath, outputYamlPath) {
  ensureDir(path.dirname(outputYamlPath))
  execFileSync(
    'npx',
    ['--yes', '@redocly/cli', 'bundle', inputYamlPath, '--output', outputYamlPath],
    { cwd: ROOT_DIR, stdio: 'inherit' }
  )
}

function runOpenApiChanges(oldSpecPath, newSpecPath, reportHtmlPath, reportJsonPath) {
  ensureDir(path.dirname(reportHtmlPath))
  ensureDir(path.dirname(reportJsonPath))

  execFileSync(
    'npx',
    [
      '--yes',
      '@pb33f/openapi-changes',
      '--no-logo',
      'html-report',
      oldSpecPath,
      newSpecPath,
      '--report-file',
      reportHtmlPath,
      '--no-color',
    ],
    { cwd: ROOT_DIR, stdio: 'inherit' }
  )

  const reportOutput = execFileSync(
    'npx',
    [
      '--yes',
      '@pb33f/openapi-changes',
      '--no-logo',
      'report',
      oldSpecPath,
      newSpecPath,
      '--no-color',
    ],
    { cwd: ROOT_DIR, encoding: 'utf8' }
  )

  fs.writeFileSync(reportJsonPath, reportOutput, 'utf8')
}

function readDiffSummary(jsonPath) {
  const content = fs.readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(content)
  const reportSummary = data.reportSummary || {}
  const componentSummary = reportSummary.components || {}
  const pathSummary = reportSummary.paths || {}
  const infoSummary = reportSummary.info || {}
  const changes = Array.isArray(data.changes) ? data.changes : []
  const breakingChanges = changes.filter((change) => change && change.breaking).length
  const totalChanges = changes.length

  return {
    totalChanges,
    breakingChanges,
    pathChanges: Number(pathSummary.totalChanges) || 0,
    pathBreakingChanges: Number(pathSummary.breakingChanges) || 0,
    componentChanges: Number(componentSummary.totalChanges) || 0,
    componentBreakingChanges: Number(componentSummary.breakingChanges) || 0,
    infoChanges: Number(infoSummary.totalChanges) || 0,
  }
}

function diffState(summary) {
  if (summary.totalChanges === 0) {
    return 'no_changes'
  }
  if (summary.breakingChanges > 0) {
    return 'incompatible'
  }
  return 'compatible'
}

function formatStateLabel(state) {
  if (state === 'no_changes') {
    return 'No changes'
  }
  if (state === 'compatible') {
    return 'Compatible changes'
  }
  return 'Incompatible changes'
}

function renderComparisonPage(targetVersion, baselineVersion, summary) {
  const state = diffState(summary)
  const stateClass = `state-${state}`
  const breakingLabel = summary.breakingChanges > 0 ? 'Yes' : 'No'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OCPI ${targetVersion} vs ${baselineVersion} - OpenAPI diff</title>
  <style>
    :root {
      --bg: #f7fafc;
      --panel: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
      --link: #0b4f8a;
      --ok: #0f766e;
      --warn: #b45309;
      --danger: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top right, #dbeafe 0%, #f7fafc 48%, #f8fafc 100%);
      color: var(--text);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      line-height: 1.45;
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 20px 16px 28px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06);
    }
    .top-links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    a { color: var(--link); text-decoration: none; font-weight: 600; }
    a:hover, a:focus { text-decoration: underline; text-underline-offset: 2px; }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.2;
      letter-spacing: 0.01em;
    }
    .meta {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }
    .metric {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      background: #f8fafc;
    }
    .metric .label {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    .metric .value {
      font-size: 22px;
      font-weight: 700;
      line-height: 1;
    }
    .state-no_changes .value { color: var(--ok); }
    .state-compatible .value { color: var(--warn); }
    .state-incompatible .value { color: var(--danger); }
    .report {
      margin-top: 14px;
      width: 100%;
      min-height: 68vh;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
    }
    .footer {
      margin-top: 10px;
      color: var(--muted);
      font-size: 13px;
    }
    @media (max-width: 960px) {
      .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 620px) {
      .summary-grid { grid-template-columns: 1fr; }
      h1 { font-size: 23px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <div class="top-links">
        <a href="../index.html">Back to diff list</a>
        <a href="/api/${targetVersion}/">API Reference</a>
        <a href="/api/${targetVersion}/swagger/">Swagger UI</a>
        <a href="/ocpi/${targetVersion}/index.html">Back to specification</a>
        <a href="./report.html">Open full report</a>
      </div>

      <h1>OCPI ${targetVersion} vs ${baselineVersion}</h1>
      <p class="meta">OpenAPI diff summary for OCPI ${targetVersion} (new) against OCPI ${baselineVersion} (baseline).</p>

      <div class="summary-grid ${stateClass}">
        <div class="metric">
          <div class="label">State</div>
          <div class="value">${formatStateLabel(state)}</div>
        </div>
        <div class="metric">
          <div class="label">Breaking</div>
          <div class="value">${breakingLabel}</div>
        </div>
        <div class="metric">
          <div class="label">Total changes</div>
          <div class="value">${summary.totalChanges}</div>
        </div>
        <div class="metric">
          <div class="label">Path changes</div>
          <div class="value">${summary.pathChanges}</div>
        </div>
        <div class="metric">
          <div class="label">Component changes</div>
          <div class="value">${summary.componentChanges}</div>
        </div>
      </div>

      <iframe class="report" src="./report.html" title="OpenAPI diff report"></iframe>
      <p class="footer">Breaking changes: ${summary.breakingChanges} total, including ${summary.pathBreakingChanges} in paths and ${summary.componentBreakingChanges} in components.</p>
    </div>
  </div>
</body>
</html>
`
}

function renderVersionDiffIndex(targetVersion, comparisons) {
  const items = comparisons
    .map(({ baselineVersion, summary }) => {
      const state = formatStateLabel(diffState(summary))
      const breaking = summary.breakingChanges > 0 ? 'Breaking changes detected' : 'No breaking changes detected'
      return `<li>
  <a href="./vs-${baselineVersion}/index.html">OCPI ${targetVersion} vs ${baselineVersion}</a>
  <span>- ${state}. ${breaking} (${summary.breakingChanges}/${summary.totalChanges}).</span>
</li>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OCPI ${targetVersion} - OpenAPI diff</title>
  <style>
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      line-height: 1.5;
    }
    .wrap {
      max-width: 920px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      padding: 18px;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.2;
    }
    p {
      margin: 0 0 14px;
      color: #475569;
    }
    ul {
      margin: 0;
      padding-left: 22px;
    }
    li {
      margin: 8px 0;
    }
    a {
      color: #0b4f8a;
      font-weight: 600;
      text-decoration: none;
    }
    a:hover, a:focus {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .top-links {
      margin-bottom: 10px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <div class="top-links">
        <a href="/api/${targetVersion}/">API Reference</a>
        <a href="/api/${targetVersion}/swagger/">Swagger UI</a>
        <a href="/ocpi/${targetVersion}/index.html">Back to specification</a>
      </div>
      <h1>OpenAPI diffs for OCPI ${targetVersion}</h1>
      <p>Choose a baseline version to inspect compatibility and breaking changes.</p>
      <ul>
${items}
      </ul>
    </div>
  </div>
</body>
</html>
`
}

function buildComparison(targetVersion, baselineVersion, bundledSpecsByVersion) {
  const targetSpec = bundledSpecsByVersion[targetVersion]
  const baselineSpec = bundledSpecsByVersion[baselineVersion]

  if (!targetSpec || !fileExists(targetSpec)) {
    throw new Error(`Missing bundled OpenAPI spec for target version: ${targetVersion}`)
  }
  if (!baselineSpec || !fileExists(baselineSpec)) {
    throw new Error(`Missing bundled OpenAPI spec for baseline version: ${baselineVersion}`)
  }

  const comparisonDir = path.join(PUBLIC_API_DIR, targetVersion, 'diff', `vs-${baselineVersion}`)
  const reportHtmlPath = path.join(comparisonDir, 'report.html')
  const reportJsonPath = path.join(comparisonDir, 'report.json')
  const indexPath = path.join(comparisonDir, 'index.html')

  ensureDir(comparisonDir)

  runOpenApiChanges(baselineSpec, targetSpec, reportHtmlPath, reportJsonPath)
  const summary = readDiffSummary(reportJsonPath)
  writeFile(indexPath, renderComparisonPage(targetVersion, baselineVersion, summary))

  return { baselineVersion, summary }
}

function main() {
  const targetVersions = Object.keys(OPENAPI_DIFF_BASELINES).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

  if (!targetVersions.length) {
    console.log('No OpenAPI diff comparisons configured. Skipping.')
    return
  }

  ensureDir(PUBLIC_API_DIR)

  const versionsToPrepare = new Set()
  for (const targetVersion of targetVersions) {
    versionsToPrepare.add(targetVersion)
    for (const baselineVersion of OPENAPI_DIFF_BASELINES[targetVersion]) {
      versionsToPrepare.add(baselineVersion)
    }
  }

  for (const version of versionsToPrepare) {
    runNodeScript('generate-root-openapi.js', [version])
  }

  const bundledSpecsByVersion = {}
  const bundleCacheDir = path.join(PUBLIC_API_DIR, '.cache', 'openapi-diff')
  for (const version of versionsToPrepare) {
    const rootSpec = path.join(OPENAPI_ROOT_DIR, `ocpi-${version}`, 'openapi.yaml')
    if (!fileExists(rootSpec)) {
      throw new Error(`Missing OpenAPI root spec for version ${version}: ${rootSpec}`)
    }

    const bundledSpec = path.join(bundleCacheDir, `ocpi-${version}.yaml`)
    bundleOpenApiYaml(rootSpec, bundledSpec)
    bundledSpecsByVersion[version] = bundledSpec
  }

  for (const targetVersion of targetVersions) {
    const comparisons = []
    const baselineVersions = OPENAPI_DIFF_BASELINES[targetVersion]

    for (const baselineVersion of baselineVersions) {
      console.log(`Building OpenAPI diff: OCPI ${targetVersion} vs ${baselineVersion}`)
      comparisons.push(buildComparison(targetVersion, baselineVersion, bundledSpecsByVersion))
    }

    const versionDiffIndexPath = path.join(PUBLIC_API_DIR, targetVersion, 'diff', 'index.html')
    writeFile(versionDiffIndexPath, renderVersionDiffIndex(targetVersion, comparisons))
    console.log(`Built OpenAPI diff index: public/api/${targetVersion}/diff/index.html`)
  }
}

try {
  main()
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
}
