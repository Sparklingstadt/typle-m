#!/usr/bin/env node
// Read-only comparison. Only exact, reviewed platform hunks are suppressed; no Swift parsing or broad ignores.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const macRoot = path.resolve(__dirname, '..')
const mappings = [['Shared', 'ios/Typle'], ['TypleCore', 'ios/TypleCore']]
const generated = new Set(['.build', '.swiftpm', 'build', 'DerivedData', 'xcuserdata', '.git'])
// UIKit's input control is replaced by Typle/Practice/PracticeTextField.swift (AppKit), outside the shared trees.
const iPadOnly = new Set(['ios/Typle/Practice/PracticeTextField.swift'])

function swiftFiles(root, prefix) {
  const files = []
  function visit(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not supported: ${file}`)
      if (entry.isDirectory()) {
        if (!generated.has(entry.name)) visit(file)
      } else if (entry.isFile() && entry.name.endsWith('.swift')) files.push(file)
    }
  }
  visit(prefix) // Missing/invalid checkout paths are errors, never a successful empty comparison.
  return files.sort()
}

function hunks(diff) {
  const lines = diff.replace(/\n$/, '').split('\n')
  const result = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('@@ ')) continue
    const header = lines[i]
    const body = []
    while (i + 1 < lines.length && !lines[i + 1].startsWith('@@ ')) body.push(lines[++i])
    result.push({ header, body: body.join('\n') })
  }
  return result
}

function key(mac, iPad, body) { return JSON.stringify([mac, iPad, body]) }

function platformHunks() {
  const patch = fs.readFileSync(path.join(__dirname, 'shared-swift-platform.patch'), 'utf8')
  const counts = new Map()
  for (const block of patch.split(/(?=^diff --git )/m).filter(Boolean)) {
    const mac = block.match(/^--- a\/(.+)$/m)?.[1]
    const iPad = block.match(/^\+\+\+ b\/(.+)$/m)?.[1]
    const valid = mappings.some(([local, upstream]) => mac?.startsWith(`${local}/`) && iPad === `${upstream}/${mac.slice(local.length + 1)}`)
    const reviewed = hunks(block)
    if (!valid || !reviewed.length) throw new Error('Invalid shared-swift-platform.patch; review its paths and hunks.')
    for (const { body } of reviewed) {
      const id = key(mac, iPad, body)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  if (!counts.size) throw new Error('shared-swift-platform.patch contains no reviewed differences.')
  return counts
}

function fileDiff(oldFile, newFile) {
  const result = spawnSync('git', [
    '--no-pager', 'diff', '--no-index', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames',
    '--text', '--diff-algorithm=myers', '--no-indent-heuristic', '--unified=3', '--', oldFile, newFile,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr || `git diff exited ${result.status}`)
  return result.stdout
}

function checkSharedSwift({ typleR, root = macRoot } = {}) {
  if (!typleR) throw new Error('Set TYPLE_R to the typle-r checkout root (the directory containing ios/).')
  root = path.resolve(root)
  typleR = path.resolve(typleR)
  const accepted = platformHunks()
  const differences = []
  let checkedFiles = 0
  let acceptedHunks = 0
  for (const [local, upstream] of mappings) {
    const macFiles = new Set(swiftFiles(root, local).map(file => file.slice(local.length + 1)))
    const iPadFiles = new Set(swiftFiles(typleR, upstream).filter(file => !iPadOnly.has(file)).map(file => file.slice(upstream.length + 1)))
    for (const relative of [...new Set([...macFiles, ...iPadFiles])].sort()) {
      const mac = `${local}/${relative}`
      const iPad = `${upstream}/${relative}`
      const hasMac = macFiles.has(relative)
      const hasIPad = iPadFiles.has(relative)
      const diff = fileDiff(hasMac ? path.join(root, mac) : '/dev/null', hasIPad ? path.join(typleR, iPad) : '/dev/null')
      checkedFiles++
      const pending = hunks(diff).filter(({ body }) => {
        const id = key(mac, iPad, body)
        if (hasMac && hasIPad && accepted.get(id) > 0) {
          accepted.set(id, accepted.get(id) - 1)
          acceptedHunks++
          return false
        }
        return true
      })
      if (pending.length || !hasMac || !hasIPad) {
        differences.push({ mac, iPad, kind: !hasMac ? 'iPad-only' : !hasIPad ? 'Mac-only' : 'changed', hunks: pending })
      } else if (diff && !hunks(diff).length) throw new Error(`Unable to read diff for ${mac}`)
    }
  }
  return { checkedFiles, acceptedHunks, differences }
}

function formatReport(result) {
  const lines = [`Shared Swift: ${result.checkedFiles} file pairs; ${result.acceptedHunks} reviewed platform hunks excluded.`]
  for (const item of result.differences) {
    lines.push('', `[${item.kind}] ${item.mac} <-> ${item.iPad}`, `--- typle-m/${item.mac}`, `+++ typle-r/${item.iPad}`)
    for (const hunk of item.hunks) lines.push(hunk.header, hunk.body)
  }
  lines.push('', result.differences.length
    ? `${result.differences.length} file(s) need review. '-' is Mac, '+' is iPad. Nothing was changed.`
    : 'No unreviewed shared Swift differences. Nothing was changed.')
  return lines.join('\n')
}

if (require.main === module) {
  try {
    if (process.argv.length > 2) {
      if (process.argv.length !== 3 || process.argv[2] !== '--help') throw new Error('Only --help is supported; specify the checkout with TYPLE_R.')
      console.log('TYPLE_R=/path/to/typle-r node scripts/check-shared-swift.cjs\nExit codes: 0 = no unreviewed differences, 1 = review needed, 2 = configuration/tool error.\nCompares the local working files only; no fetch, writes, or code import.')
    } else {
      const result = checkSharedSwift({ typleR: process.env.TYPLE_R })
      console.log(formatReport(result))
      process.exitCode = result.differences.length ? 1 : 0
    }
  } catch (error) {
    console.error(`Shared Swift check failed: ${error.message}`)
    process.exitCode = 2
  }
}

module.exports = { checkSharedSwift, formatReport }
