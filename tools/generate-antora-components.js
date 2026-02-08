const fs = require('fs')
const path = require('path')

const ROOT_DIR = process.cwd()
const SPECIFICATIONS_DIR = path.join(ROOT_DIR, 'specifications')
const OUTPUT_ROOT = path.join(ROOT_DIR, 'antora', 'components')

const IGNORE_DOC_FILES = new Set([
  'pdf_layout.asciidoc',
  'README.md',
  'CONTRIBUTING.md',
  'template-object-description.asciidoc',
  'template-object-description.md',
])
const ROOT_ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.gif'])
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

function listRootDocFiles(sourceDir) {
  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith('.asciidoc') || entry.name.endsWith('.md')) &&
        !IGNORE_DOC_FILES.has(entry.name)
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

function toAdocName(fileName) {
  return fileName.replace(/\.(asciidoc|md)$/, '.adoc')
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

function convertMarkdownInlineLinks(text) {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\{\[([^\]]+)\]\([^\)]+\)\}/g, '{$1}')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 'image::$2[$1]')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawTarget) => {
      const target = rawTarget.trim()

      if (target.startsWith('#')) {
        return `xref:${target}[${label}]`
      }

      if (/^(https?:\/\/|mailto:)/i.test(target)) {
        return `${target}[${label}]`
      }

      if (/\.(md|asciidoc)(#.*)?$/i.test(target)) {
        const rewritten = target
          .replace(/\.md(?=#|$)/gi, '.adoc')
          .replace(/\.asciidoc(?=#|$)/gi, '.adoc')
          .replace(/mod_command\.adoc/gi, 'mod_commands.adoc')
          .replace(/^([^/].*)$/, 'spec/$1')
        return `xref:${rewritten}[${label}]`
      }

      return `link:${target}[${label}]`
    })
}

function convertMarkdownTableLines(lines) {
  const converted = ['|===']
  let expectedColumnCount = 0
  let hasInvalidRow = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) {
      continue
    }

    const cells = trimmed
      .replace(/^\s*\|\s*/, '')
      .replace(/\|\s*$/, '')
      .split(/(?<!\\)\|/)
      .map((cell) => convertMarkdownInlineLinks(cell.trim()).replace(/\\\|/g, '\\|'))
    while (cells.length > 0 && cells[cells.length - 1] === '') {
      cells.pop()
    }
    if (!expectedColumnCount) {
      expectedColumnCount = cells.length
    }
    if (expectedColumnCount && cells.length > expectedColumnCount) {
      const head = cells.slice(0, expectedColumnCount - 1)
      const tail = cells.slice(expectedColumnCount - 1).join(' | ')
      cells.length = 0
      cells.push(...head, tail)
    }
    if (expectedColumnCount && cells.length !== expectedColumnCount) {
      hasInvalidRow = true
      break
    }
    converted.push(`| ${cells.join(' | ')}`)
  }
  if (hasInvalidRow) {
    return ['[listing]', '....', ...lines, '....']
  }
  converted.push('|===')
  return converted
}

function convertMarkdownToAsciidoc(content) {
  const sourceLines = content.replace(/\r\n/g, '\n').split('\n')
  const output = []
  let inCodeBlock = false
  const firstHeadingLevel = sourceLines.reduce((acc, line) => {
    if (acc) {
      return acc
    }
    const heading = line.match(/^(#{1,6})\s+/)
    return heading ? heading[1].length : 0
  }, 0)

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i]
    const trimmed = line.trim()

    const codeFence = trimmed.match(/^```\s*([A-Za-z0-9_-]+)?\s*$/)
    if (codeFence) {
      if (!inCodeBlock) {
        const lang = codeFence[1]
        if (lang) {
          output.push(`[source,${lang.toLowerCase()}]`)
        }
        output.push('----')
        inCodeBlock = true
      } else {
        output.push('----')
        inCodeBlock = false
      }
      continue
    }

    if (inCodeBlock) {
      output.push(line)
      continue
    }

    if (/^<div><!--.*--><\/div>$/.test(trimmed) || /^&nbsp;\s*$/.test(trimmed)) {
      output.push('')
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const normalizedLevel = firstHeadingLevel
        ? Math.max(2, heading[1].length - firstHeadingLevel + 2)
        : heading[1].length + 1
      output.push(`${'='.repeat(normalizedLevel)} ${convertMarkdownInlineLinks(heading[2])}`)
      continue
    }

    const isTableStart = trimmed.startsWith('|') && i + 1 < sourceLines.length && /^\s*\|?\s*:?-{3,}/.test(sourceLines[i + 1])
    if (isTableStart) {
      const tableLines = [line]
      i += 2
      while (i < sourceLines.length && sourceLines[i].trim().startsWith('|')) {
        tableLines.push(sourceLines[i])
        i += 1
      }
      i -= 1
      output.push(...convertMarkdownTableLines(tableLines))
      continue
    }

    output.push(convertMarkdownInlineLinks(line))
  }

  return output.join('\n')
}

function titleFromFilename(fileName) {
  const baseName = fileName.replace(/\.(asciidoc|md)$/, '')
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

function aboutPageContent() {
  return `= About

This site is maintained by Julien Herr.

* Website: https://juherr.dev/
* Contact: mailto:ocpi@juherr.dev[ocpi@juherr.dev]
* Source code: https://github.com/juherr/ocpi-doc
`
}

function writeAboutPage(pagesDir) {
  writeFile(path.join(pagesDir, 'about.adoc'), `${aboutPageContent()}\n`)
}

function writeVersionHomePage(pagesDir, version) {
  const notice = deprecatedNotice(version)
  writeFile(
    path.join(pagesDir, 'index.adoc'),
    `= OCPI ${version}

This documentation page is generated from the OCPI \`${version}\` release branch.${notice}

See xref:spec/introduction.adoc[Introduction] to start reading the specification.
API Reference for this version: link:/api/${version}/[API Reference (OCPI ${version})].
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
  writeAboutPage(pagesDir)

  const navLines = ['* xref:index.adoc[Home]', '* Spec']

  for (const fileName of asciidocFiles) {
    const wrapperName = toAdocName(fileName)
    const wrapperPath = path.join(specPagesDir, wrapperName)
    const partialName = toAdocName(fileName)
    const title = titleFromFilename(fileName)
    const editUrl = getUpstreamEditUrl(version, fileName)
    const editHeader = editUrl ? `:page-upstream-edit-url: ${editUrl}` : ''

    writeFile(
      wrapperPath,
      `= ${title}
${editHeader ? `${editHeader}\n` : ''}

include::partial$src/${partialName}[]
`
    )

    navLines.push(`** xref:spec/${wrapperName}[${title}]`)
  }

  navLines.push('* xref:about.adoc[About]')

  writeFile(path.join(moduleRoot, 'nav.adoc'), `${navLines.join('\n')}\n`)
}

function generateFallbackComponent(componentDir, version) {
  const moduleRoot = path.join(componentDir, 'modules', 'ROOT')
  const pagesDir = path.join(moduleRoot, 'pages')

  ensureDir(pagesDir)

  writeFallbackHomePage(pagesDir, version)
  writeAboutPage(pagesDir)

  writeFile(path.join(moduleRoot, 'nav.adoc'), '* xref:index.adoc[Home]\n* xref:about.adoc[About]\n')
}

function syncVersion(versionInfo) {
  const { folderName, version, sourceDir } = versionInfo
  const componentDir = path.join(OUTPUT_ROOT, folderName)
  const moduleRoot = path.join(componentDir, 'modules', 'ROOT')
  const partialsSourceDir = path.join(moduleRoot, 'partials', 'src')

  const docFiles = listRootDocFiles(sourceDir)

  if (fileExists(componentDir)) {
    fs.rmSync(componentDir, { recursive: true, force: true })
  }

  writeAntoraDescriptor(componentDir, version)

  if (!docFiles.length) {
    generateFallbackComponent(componentDir, version)
    return {
      folderName,
      version,
      fileCount: 0,
      fallback: true,
    }
  }

  generateComponentPages(componentDir, version, docFiles)

  for (const fileName of docFiles) {
    const sourcePath = path.join(sourceDir, fileName)
    const targetPath = path.join(partialsSourceDir, toAdocName(fileName))
    const sourceContent = fs.readFileSync(sourcePath, 'utf8')
    const transformedContent = fileName.endsWith('.md')
      ? convertMarkdownToAsciidoc(sourceContent)
      : rewriteAsciidocReferences(sourceContent)
    writeFile(targetPath, transformedContent)
  }

  copyDirRecursive(path.join(sourceDir, 'examples'), path.join(partialsSourceDir, 'examples'))
  copyDirRecursive(path.join(sourceDir, 'images'), path.join(moduleRoot, 'images', 'images'))
  copyDirRecursive(path.join(sourceDir, 'data'), path.join(moduleRoot, 'images', 'data'))

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }
    const ext = path.extname(entry.name).toLowerCase()
    if (!ROOT_ASSET_EXTENSIONS.has(ext)) {
      continue
    }
    fs.copyFileSync(path.join(sourceDir, entry.name), path.join(moduleRoot, 'images', entry.name))
  }

  return {
    folderName,
    version,
    fileCount: docFiles.length,
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
