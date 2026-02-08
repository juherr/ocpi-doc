const fs = require('fs')
const path = require('path')

const ROOT_DIR = process.cwd()
const SPECIFICATIONS_DIR = path.join(ROOT_DIR, 'specifications')
const OUTPUT_ROOT = path.join(ROOT_DIR, 'antora', 'components')

const IGNORE_ASCIIDOC = new Set(['pdf_layout.asciidoc'])
const DEPRECATED_VERSIONS = {
  '2.2.0': '2.2.1',
}
const UPSTREAM_BRANCHES = {
  '2.3.0': 'release-2.3.0-bugfixes',
  '2.2.1': 'release-2.2.1-bugfixes',
  '2.2.0': 'release-2.2-bugfixes',
  '2.1.1': 'release-2.1.1-bugfixes',
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

function copyDirRecursive(sourceDir, targetDir) {
  if (!fileExists(sourceDir)) {
    return
  }

  ensureDir(targetDir)

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

function listSpecificationVersions() {
  if (!fileExists(SPECIFICATIONS_DIR)) {
    return []
  }

  return fs
    .readdirSync(SPECIFICATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('ocpi-'))
    .map((entry) => {
      const folderName = entry.name
      const version = folderName.replace(/^ocpi-/, '')
      return {
        folderName,
        version,
        sourceDir: path.join(SPECIFICATIONS_DIR, folderName),
      }
    })
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
}

function listRootAsciidocFiles(sourceDir) {
  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.asciidoc') && !IGNORE_ASCIIDOC.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

function toAdocName(fileName) {
  return fileName.replace(/\.asciidoc$/, '.adoc')
}

function rewriteAsciidocReferences(content) {
  return content
    .replace(/\.asciidoc/g, '.adoc')
    .replace(/\.ascii#/g, '.adoc#')
    .replace(/transport_and_format_not_available\.adoc#transport_and_format_not_available/g, 'transport_and_format.adoc#transport_and_format_not_available')
    .replace(/(\|message\|<<[^>]+>>\|\*\|[^\n|]+)\|$/gm, '$1')
    .replace(/<<((?!spec\/)[a-z0-9_\-]+\.adoc)([#,])/gi, '<<spec/$1$2')
    .replace(/xref:((?!spec\/)[a-z0-9_\-]+\.adoc)/gi, 'xref:spec/$1')
}

function titleFromFilename(fileName) {
  const baseName = fileName.replace(/\.asciidoc$/, '')
  const normalized = baseName.replace(/^mod_/, '').replace(/[_-]+/g, ' ').trim()
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function getUpstreamEditUrl(version, fileName) {
  const branch = UPSTREAM_BRANCHES[version]
  if (!branch) {
    return null
  }

  return `https://github.com/ocpi/ocpi/blob/${branch}/${fileName}`
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
}

function writeAntoraDescriptor(componentDir, version) {
  const antoraYmlPath = path.join(componentDir, 'antora.yml')
  const replacementVersion = DEPRECATED_VERSIONS[version]
  const displayVersion = replacementVersion ? `${version} (deprecated)` : version
  const prereleaseLine = replacementVersion ? 'prerelease: true\n' : ''
  writeFile(
    antoraYmlPath,
    `name: ocpi
title: OCPI
version: ${version}
display_version: ${displayVersion}
${prereleaseLine}nav:
  - modules/ROOT/nav.adoc
`
  )
}

function deprecatedNotice(version) {
  const replacementVersion = DEPRECATED_VERSIONS[version]
  if (!replacementVersion) {
    return ''
  }

  return `\n[IMPORTANT]\n====\nThis version is deprecated. Use OCPI ${replacementVersion} instead.\n====\n`
}

function writeVersionHomePage(pagesDir, version) {
  const notice = deprecatedNotice(version)
  writeFile(
    path.join(pagesDir, 'index.adoc'),
    `= OCPI ${version}

This documentation page is generated from the OCPI \`${version}\` release branch.${notice}

See xref:spec/introduction.adoc[Introduction] to start reading the specification.
`
  )
}

function writeFallbackHomePage(pagesDir, version) {
  const notice = deprecatedNotice(version)
  writeFile(
    path.join(pagesDir, 'index.adoc'),
    `= OCPI ${version}

This version is imported from upstream, but its source files are not in AsciiDoc format.${notice}

For now, this version is available as source-only under \`specifications/ocpi-${version}\`.
`
  )
}

function generateComponentPages(componentDir, version, asciidocFiles) {
  const moduleRoot = path.join(componentDir, 'modules', 'ROOT')
  const pagesDir = path.join(moduleRoot, 'pages')
  const specPagesDir = path.join(pagesDir, 'spec')
  const partialsSourceDir = path.join(moduleRoot, 'partials', 'src')

  ensureDir(specPagesDir)
  ensureDir(partialsSourceDir)

  writeVersionHomePage(pagesDir, version)

  const navLines = ['* xref:index.adoc[Home]', '* Spec']

  for (const fileName of asciidocFiles) {
    const wrapperName = toAdocName(fileName)
    const wrapperPath = path.join(specPagesDir, wrapperName)
    const partialName = toAdocName(fileName)
    const title = titleFromFilename(fileName)
    const editUrl = getUpstreamEditUrl(version, fileName)
    const editHeader = editUrl ? `:page-editable: true\n:page-edit-url: ${editUrl}` : ':page-editable: false'

    writeFile(
      wrapperPath,
      `= ${title}
${editHeader}

include::partial$src/${partialName}[]
`
    )

    navLines.push(`** xref:spec/${wrapperName}[${title}]`)
  }

  writeFile(path.join(moduleRoot, 'nav.adoc'), `${navLines.join('\n')}\n`)
}

function generateFallbackComponent(componentDir, version) {
  const moduleRoot = path.join(componentDir, 'modules', 'ROOT')
  const pagesDir = path.join(moduleRoot, 'pages')

  ensureDir(pagesDir)

  writeFallbackHomePage(pagesDir, version)

  writeFile(path.join(moduleRoot, 'nav.adoc'), '* xref:index.adoc[Home]\n')
}

function syncVersion(versionInfo) {
  const { folderName, version, sourceDir } = versionInfo
  const componentDir = path.join(OUTPUT_ROOT, folderName)
  const moduleRoot = path.join(componentDir, 'modules', 'ROOT')
  const partialsSourceDir = path.join(moduleRoot, 'partials', 'src')

  const asciidocFiles = listRootAsciidocFiles(sourceDir)

  if (fileExists(componentDir)) {
    fs.rmSync(componentDir, { recursive: true, force: true })
  }

  writeAntoraDescriptor(componentDir, version)

  if (!asciidocFiles.length) {
    generateFallbackComponent(componentDir, version)
    return {
      folderName,
      version,
      fileCount: 0,
      fallback: true,
    }
  }

  generateComponentPages(componentDir, version, asciidocFiles)

  for (const fileName of asciidocFiles) {
    const sourcePath = path.join(sourceDir, fileName)
    const targetPath = path.join(partialsSourceDir, toAdocName(fileName))
    const sourceContent = fs.readFileSync(sourcePath, 'utf8')
    writeFile(targetPath, rewriteAsciidocReferences(sourceContent))
  }

  copyDirRecursive(path.join(sourceDir, 'examples'), path.join(partialsSourceDir, 'examples'))
  copyDirRecursive(path.join(sourceDir, 'images'), path.join(moduleRoot, 'images', 'images'))

  return {
    folderName,
    version,
    fileCount: asciidocFiles.length,
    fallback: false,
  }
}

function main() {
  const versions = listSpecificationVersions()
  if (!versions.length) {
    console.error('No specifications/ocpi-* directories found.')
    process.exit(1)
  }

  ensureDir(OUTPUT_ROOT)

  const results = versions.map(syncVersion)
  for (const result of results) {
    if (result.fallback) {
      console.log(`Generated ${result.folderName} (v${result.version}) as fallback component`)
    } else {
      console.log(`Generated ${result.folderName} (v${result.version}) with ${result.fileCount} pages`)
    }
  }
}

main()
