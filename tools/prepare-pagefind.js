const fs = require('fs')
const path = require('path')

const root = path.join(process.cwd(), 'public', 'ocpi')

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, out)
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(fullPath)
    }
  }
  return out
}

function addIgnoreToEditLink(html) {
  return html.replace(
    /<div class="edit-this-page"(?![^>]*data-pagefind-ignore)/g,
    '<div class="edit-this-page" data-pagefind-ignore="all"'
  )
}

function reduceModuleBoilerplate(html, filePath) {
  if (!/[/\\]spec[/\\]mod_[^/\\]+\.html$/.test(filePath)) {
    return html
  }

  let next = html

  next = next.replace(
    /<h1 class="page">/,
    '<h1 class="page" data-pagefind-ignore="all">'
  )

  next = next.replace(
    /<h2 id="[^"]*_module">/,
    (match) => match.replace('>', ' data-pagefind-ignore="all">')
  )

  next = next.replace(
    /<p><strong>Module Identifier:/,
    '<p data-pagefind-ignore="all"><strong>Module Identifier:'
  )

  return next
}

function extractVersionFromPath(filePath) {
  const match = filePath.match(/[/\\]ocpi[/\\]([^/\\]+)[/\\]/)
  return match ? match[1] : null
}

function ignoreLatestAlias(html, filePath) {
  const version = extractVersionFromPath(filePath)
  if (version !== 'latest') return html

  return html.replace(/<body([^>]*)>/, (match, attrs) => {
    if (attrs.includes('data-pagefind-ignore="all"')) return match
    return `<body${attrs} data-pagefind-ignore="all">`
  })
}

function injectVersionMetadata(html, filePath) {
  const version = extractVersionFromPath(filePath)
  if (!version) return html

  const marker = `<div class="jh-pagefind-version" hidden aria-hidden="true" data-pagefind-ignore data-pagefind-meta="version:${version}" data-pagefind-filter="Version">${version}</div>`
  const existingPattern = /\n?<div class="jh-pagefind-version"[^>]*>[\s\S]*?<\/div>/

  if (existingPattern.test(html)) {
    return html.replace(existingPattern, `\n${marker}`)
  }

  return html.replace(/<body[^>]*>/, (match) => `${match}\n${marker}`)
}

function main() {
  if (!fs.existsSync(root)) {
    console.log('prepare-pagefind: no public/ocpi directory, skipping')
    return
  }

  const htmlFiles = walk(root)
  let changedCount = 0

  for (const filePath of htmlFiles) {
    const original = fs.readFileSync(filePath, 'utf8')
    let updated = original

    updated = ignoreLatestAlias(updated, filePath)
    updated = addIgnoreToEditLink(updated)
    updated = reduceModuleBoilerplate(updated, filePath)
    updated = injectVersionMetadata(updated, filePath)

    if (updated !== original) {
      fs.writeFileSync(filePath, updated)
      changedCount += 1
    }
  }

  console.log(`prepare-pagefind: updated ${changedCount} HTML files`)
}

main()
