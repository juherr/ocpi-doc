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
const LIBRARIES_BY_VERSION = {
  '2.2.1': [
    {
      technology: 'C#',
      name: 'BitzArt/OCPI.Net',
      url: 'https://github.com/BitzArt/OCPI.Net',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: '.NET implementation of OCPI with public documentation and package distribution.',
    },
    {
      technology: 'Java',
      name: 'Llocer/llocer_ocpi',
      url: 'https://github.com/Llocer/llocer_ocpi',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Open source library for implementing OCPI 2.2.1 nodes.',
    },
    {
      technology: 'Java',
      name: 'extrawest/Extrawest-OCPI-2.2.1',
      url: 'https://github.com/extrawest/Extrawest-OCPI-2.2.1',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Core Java package with shared OCPI 2.2.1 components used by Extrawest client and server libraries.',
    },
    {
      technology: 'Java',
      name: 'extrawest/Extrawest-OCPI-2.2.1-CPO-Client',
      url: 'https://github.com/extrawest/Extrawest-OCPI-2.2.1-CPO-Client',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Java client library for CPO systems that call OCPI 2.2.1 endpoints.',
    },
    {
      technology: 'Java',
      name: 'extrawest/Extrawest-OCPI-2.2.1-CPO-Server',
      url: 'https://github.com/extrawest/Extrawest-OCPI-2.2.1-CPO-Server',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Java server library for building OCPI 2.2.1 CPO applications.',
    },
    {
      technology: 'Java',
      name: 'extrawest/Extrawest-OCPI-2.2.1-EMSP-Client',
      url: 'https://github.com/extrawest/Extrawest-OCPI-2.2.1-EMSP-Client',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Java client library for eMSP systems that call OCPI 2.2.1 endpoints.',
    },
    {
      technology: 'Java',
      name: 'extrawest/Extrawest-OCPI-2.2.1-EMSP-Server',
      url: 'https://github.com/extrawest/Extrawest-OCPI-2.2.1-EMSP-Server',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Java server library for building OCPI 2.2.1 eMSP applications.',
    },
    {
      technology: 'Go',
      name: 'ChargePi/ocpi-sdk-go',
      url: 'https://github.com/ChargePi/ocpi-sdk-go',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'Generated OCPI 2.2.1 Go client and server SDK based on OpenAPI.',
    },
    {
      technology: 'Kotlin',
      name: 'IZIVIA/ocpi-toolkit',
      url: 'https://github.com/IZIVIA/ocpi-toolkit',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'Reference Kotlin toolkit for OCPI 2.2.1 business logic and validation.',
    },
    {
      technology: 'Python',
      name: 'extrawest/extrawest_ocpi',
      url: 'https://github.com/extrawest/extrawest_ocpi',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'FastAPI-based Python implementation of OCPI with package and hosted documentation.',
    },
    {
      technology: 'Python',
      name: 'TECHS-Technological-Solutions/ocpi',
      url: 'https://github.com/TECHS-Technological-Solutions/ocpi',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'Python OCPI library published as py-ocpi with examples and hosted documentation.',
    },
    {
      technology: 'TypeScript',
      name: 'solidstudiosh/ocpi-schema',
      url: 'https://github.com/solidstudiosh/ocpi-schema',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'JSON Schema generator for OCPI 2.1.1, 2.2, and 2.2.1.',
    },
  ],
  '2.2.0': [
    {
      technology: 'C#',
      name: 'BitzArt/OCPI.Net',
      url: 'https://github.com/BitzArt/OCPI.Net',
      versionStatus: 'Partial',
      activity: 'Active',
      notes: '.NET implementation of OCPI with public documentation and package distribution.',
    },
    {
      technology: 'Python',
      name: 'NOWUM/pyOCPI',
      url: 'https://github.com/NOWUM/pyOCPI',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'Flask-RESTX OCPI 2.2 interface with generated OpenAPI support.',
    },
    {
      technology: 'TypeScript',
      name: 'andreibesleaga/ocpi-sdk',
      url: 'https://github.com/andreibesleaga/ocpi-sdk',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'TypeScript and JavaScript SDK for OCPI v2.2 endpoints with MCP server package.',
    },
    {
      technology: 'TypeScript',
      name: 'solidstudiosh/ocpi-schema',
      url: 'https://github.com/solidstudiosh/ocpi-schema',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'JSON Schema generator for OCPI 2.1.1, 2.2, and 2.2.1.',
    },
  ],
  '2.1.1': [
    {
      technology: 'C#',
      name: 'kraftvaerk/OCPI',
      url: 'https://github.com/kraftvaerk/OCPI',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Reference OCPI implementation in C# focused on DTOs and interfaces.',
    },
    {
      technology: 'C#',
      name: 'BitzArt/OCPI.Net',
      url: 'https://github.com/BitzArt/OCPI.Net',
      versionStatus: 'Planned',
      activity: 'Active',
      notes: '.NET implementation of OCPI with public documentation and package distribution.',
    },
    {
      technology: 'Go',
      name: 'evorada/ocpi-types',
      url: 'https://github.com/evorada/ocpi-types',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Auto-generated OCPI 2.1.1 type definitions for Go.',
    },
    {
      technology: 'Python',
      name: 'evorada/ocpi-types',
      url: 'https://github.com/evorada/ocpi-types',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Auto-generated OCPI 2.1.1 type definitions for Python.',
    },
    {
      technology: 'Rust',
      name: 'evorada/ocpi-types',
      url: 'https://github.com/evorada/ocpi-types',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Auto-generated OCPI 2.1.1 type definitions for Rust.',
    },
    {
      technology: 'TypeScript',
      name: 'evorada/ocpi-types',
      url: 'https://github.com/evorada/ocpi-types',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Auto-generated OCPI 2.1.1 schemas and type definitions for TypeScript.',
    },
    {
      technology: 'Python',
      name: 'extrawest/extrawest_ocpi',
      url: 'https://github.com/extrawest/extrawest_ocpi',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'FastAPI-based Python implementation of OCPI with package and hosted documentation.',
    },
    {
      technology: 'PHP',
      name: 'ChargeMap/ocpi-protocol',
      url: 'https://github.com/ChargeMap/ocpi-protocol',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'PSR-compatible OCPI library with request and response models for eMSP interfaces.',
    },
    {
      technology: 'Scala',
      name: 'ShellRechargeSolutionsEU/ocpi-endpoints',
      url: 'https://github.com/ShellRechargeSolutionsEU/ocpi-endpoints',
      versionStatus: 'Supported',
      activity: 'Inactive',
      notes: 'Scala implementation of common OCPI endpoints with client and server components.',
    },
    {
      technology: 'TypeScript',
      name: 'solidstudiosh/ocpi-schema',
      url: 'https://github.com/solidstudiosh/ocpi-schema',
      versionStatus: 'Supported',
      activity: 'Active',
      notes: 'JSON Schema generator for OCPI 2.1.1, 2.2, and 2.2.1.',
    },
  ],
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

function communityPageContent() {
  return `= Community

Find where OCPI practitioners discuss implementations, tooling, and interoperability.

== Join the community

* https://evroaming.org[EV Roaming Foundation] - official ecosystem and governance resources.
* https://www.reddit.com/r/ocpi/[Reddit: r/ocpi] - open community discussions.
* https://ocpi.slack.com[OCPI Slack] - real-time discussions with implementers.
* https://discord.gg/kd7dtcZkmt[Discord: EV Devs and Data] - developer-focused chat and data topics.
`
}

function writeCommunityPage(pagesDir) {
  writeFile(path.join(pagesDir, 'community.adoc'), `${communityPageContent()}\n`)
}

function sponsorPageContent() {
  return `= Sponsor

This site is built by and for the OCPI community.

It highlights the official OCPI documentation and brings together useful libraries, tools, services, and community resources for implementers, maintainers, and interoperability teams across eMobility.

If this site and its content save you time, reduce integration friction, or support your day-to-day work with OCPI, sponsoring is a practical way to keep this resource accurate, maintained, and freely available.

Your sponsorship directly funds:

* maintenance time and updates for this website;
* hosting and infrastructure costs.

Sponsors may be featured on this page as supporters of this independent project.

[.sponsor-cta]
https://github.com/sponsors/juherr[Become a sponsor]

All sponsorship plans, billing, and management are handled through GitHub Sponsors.
`
}

function writeSponsorPage(pagesDir) {
  writeFile(path.join(pagesDir, 'sponsor.adoc'), `${sponsorPageContent()}\n`)
}

function compareLibraries(a, b) {
  const tech = a.technology.localeCompare(b.technology)
  if (tech !== 0) {
    return tech
  }
  return a.name.localeCompare(b.name)
}

function libraryNotes(library, version) {
  if (library.versionStatus === 'Planned') {
    return `pass:[<span class="library-warning library-warning--planned">🔴 Planned support for OCPI ${version}.</span>] ${library.notes}`
  }
  if (library.versionStatus === 'Partial') {
    return `pass:[<span class="library-warning library-warning--partial">🟠 Partial support for OCPI ${version}.</span>] ${library.notes}`
  }
  return library.notes
}

function libraryPageContent(version) {
  const libraries = (LIBRARIES_BY_VERSION[version] || []).slice()
  const activeLibraries = libraries.filter((library) => library.activity === 'Active').sort(compareLibraries)
  const inactiveLibraries = libraries.filter((library) => library.activity !== 'Active').sort(compareLibraries)

  if (!libraries.length) {
    return `= Library

Community OCPI libraries and SDKs, grouped by technology.

[NOTE]
====
This list is informational and not an endorsement.
Project discovery is based on https://github.com/juherr/awesome-ev-charging[juherr/awesome-ev-charging].
====

No libraries are listed for OCPI ${version} yet.
`
  }

  const lines = [
    '= Library',
    '',
    'Community OCPI libraries and SDKs, grouped by technology.',
    '',
    '[NOTE]',
    '====',
    'This list is informational and not an endorsement.',
    'Project discovery is based on https://github.com/juherr/awesome-ev-charging[juherr/awesome-ev-charging].',
    '====',
    '',
  ]

  let currentTechnology = ''
  for (const library of activeLibraries) {
    if (library.technology !== currentTechnology) {
      if (currentTechnology) {
        lines.push('|===')
        lines.push('')
      }
      currentTechnology = library.technology
      lines.push(`== ${currentTechnology}`)
      lines.push('')
      lines.push('[cols="1,3", options="header"]')
      lines.push('|===')
      lines.push('| Project | Notes')
    }

    lines.push(`| ${library.url}[${library.name}]`)
    lines.push(`| ${libraryNotes(library, version)}`)
  }

  if (currentTechnology) {
    lines.push('|===')
  }

  if (inactiveLibraries.length) {
    if (lines[lines.length - 1] !== '') {
      lines.push('')
    }
    lines.push('== Inactive Libraries')
    lines.push('')
    lines.push('Libraries with no public repository activity in the last 12 months. These projects can still be useful for reference, migrations, or legacy integrations.')
    lines.push('')
    lines.push('[cols="1,1,2", options="header"]')
    lines.push('|===')
    lines.push('| Project | Language | Notes')

    for (const library of inactiveLibraries) {
      lines.push(`| ${library.url}[${library.name}]`)
      lines.push(`| ${library.technology}`)
      lines.push(`| ${libraryNotes(library, version)}`)
    }

    lines.push('|===')
  }

  return `${lines.join('\n')}\n`
}

function writeLibraryPage(pagesDir, version) {
  writeFile(path.join(pagesDir, 'library.adoc'), libraryPageContent(version))
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
  writeLibraryPage(pagesDir, version)
  writeCommunityPage(pagesDir)
  writeSponsorPage(pagesDir)
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

  navLines.push('* xref:library.adoc[Library]')
  navLines.push('* xref:community.adoc[Community]')
  navLines.push('* xref:sponsor.adoc[Sponsor]')
  navLines.push('* xref:about.adoc[About]')

  writeFile(path.join(moduleRoot, 'nav.adoc'), `${navLines.join('\n')}\n`)
}

function generateFallbackComponent(componentDir, version) {
  const moduleRoot = path.join(componentDir, 'modules', 'ROOT')
  const pagesDir = path.join(moduleRoot, 'pages')

  ensureDir(pagesDir)

  writeFallbackHomePage(pagesDir, version)
  writeLibraryPage(pagesDir, version)
  writeCommunityPage(pagesDir)
  writeSponsorPage(pagesDir)
  writeAboutPage(pagesDir)

  writeFile(path.join(moduleRoot, 'nav.adoc'), '* xref:index.adoc[Home]\n* xref:library.adoc[Library]\n* xref:community.adoc[Community]\n* xref:sponsor.adoc[Sponsor]\n* xref:about.adoc[About]\n')
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
