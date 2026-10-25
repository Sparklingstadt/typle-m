const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { checkSharedSwift, formatReport } = require('../scripts/check-shared-swift.cjs')

const root = path.resolve(__dirname, '..')
const script = path.join(root, 'scripts/check-shared-swift.cjs')
// A real, reviewed Theme.swift hunk, including its context. Reconstruct just this excerpt, without a second checkout.
const patch = fs.readFileSync(path.join(root, 'scripts/shared-swift-platform.patch'), 'utf8')
function themeExcerpt(index) {
  const body = patch.split('\ndiff --git ')[0].split(/^@@[^\n]*\n/m)[index + 1].replace(/\n$/, '').split('\n')
  return {
    mac: body.filter(line => !line.startsWith('+')).map(line => line.slice(1)).join('\n') + '\n',
    iPad: body.filter(line => !line.startsWith('-')).map(line => line.slice(1)).join('\n') + '\n',
  }
}
const { mac: macTheme, iPad: iPadTheme } = themeExcerpt(0)

function write(root, file, content) {
  const target = path.join(root, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'typle swift check '))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const mac = path.join(dir, 'Mac checkout')
  const iPad = path.join(dir, 'iPad checkout')
  write(mac, 'Shared/Design/Theme.swift', macTheme)
  write(iPad, 'ios/Typle/Design/Theme.swift', iPadTheme)
  for (const file of ['Package.swift', 'Sources/TypleCore/Typing.swift', 'Tests/TypleCoreTests/TypingTests.swift']) {
    write(mac, `TypleCore/${file}`, 'let shared = 1\n')
    write(iPad, `ios/TypleCore/${file}`, 'let shared = 1\n')
  }
  // These are deliberately outside the Swift comparison; a JSON list sync is a separate concern.
  write(iPad, 'ios/Typle/Practice/PracticeTextField.swift', 'import UIKit\n')
  write(mac, 'Typle/Practice/PracticeTextField.swift', 'import AppKit\n')
  write(mac, 'TypleCore/.build/debug/Generated.swift', 'generated\n')
  write(iPad, 'ios/TypleCore/.swiftpm/Generated.swift', 'generated\n')
  write(iPad, 'ios/TypleCore/Sources/TypleCore/Resources/commands.json', '["separate list update"]\n')
  return { mac, iPad, check: () => checkSharedSwift({ root: mac, typleR: iPad }) }
}

function snapshot(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name)
    return entry.isDirectory() ? snapshot(file) : [[file, fs.readFileSync(file, 'base64')]]
  })
}

test('exact platform hunks are excluded without ignoring the whole file; paths may contain spaces', t => {
  const f = fixture(t)
  assert.deepEqual(f.check(), { checkedFiles: 4, acceptedHunks: 1, differences: [] })
})

for (const file of ['Sources/TypleCore/Typing.swift', 'Tests/TypleCoreTests/TypingTests.swift', 'Package.swift']) {
  test(`an upstream change in TypleCore/${file} needs review`, t => {
    const f = fixture(t)
    write(f.iPad, `ios/TypleCore/${file}`, 'let shared = 2\n')
    const result = f.check()
    assert.equal(result.differences.length, 1)
    assert.equal(result.differences[0].mac, `TypleCore/${file}`)
    assert.match(formatReport(result), /-let shared = 1\n\+let shared = 2/)
  })
}

test('a shared change adjacent to a reviewed platform hunk is reported, including its context', t => {
  const f = fixture(t)
  write(f.iPad, 'ios/Typle/Design/Theme.swift', iPadTheme.replace('darkAlpha: CGFloat = 1', 'darkAlpha: CGFloat = 0.9'))
  const result = f.check()
  assert.equal(result.differences.length, 1)
  assert.match(formatReport(result), /\+.*darkAlpha: CGFloat = 0\.9/)
})

test('line-number shifts do not turn a reviewed platform hunk into noise', t => {
  const f = fixture(t)
  const excerpt = themeExcerpt(1)
  const prefix = Array.from({ length: 12 }, (_, i) => `// shared comment ${i}\n`).join('')
  write(f.mac, 'Shared/Design/Theme.swift', prefix + excerpt.mac)
  write(f.iPad, 'ios/Typle/Design/Theme.swift', prefix + excerpt.iPad)
  assert.deepEqual(f.check(), { checkedFiles: 4, acceptedHunks: 1, differences: [] })
})

test('identical-looking platform changes in another file are not automatically excluded', t => {
  const f = fixture(t)
  write(f.mac, 'Shared/Other.swift', macTheme)
  write(f.iPad, 'ios/Typle/Other.swift', iPadTheme)
  assert.deepEqual(f.check().differences.map(item => item.mac), ['Shared/Other.swift'])
})

test('new and removed Swift files, including empty files, need review', t => {
  const f = fixture(t)
  write(f.iPad, 'ios/Typle/NewView.swift', '')
  fs.unlinkSync(path.join(f.iPad, 'ios/TypleCore/Tests/TypleCoreTests/TypingTests.swift'))
  assert.deepEqual(f.check().differences.map(({ mac, kind }) => [mac, kind]), [
    ['Shared/NewView.swift', 'iPad-only'],
    ['TypleCore/Tests/TypleCoreTests/TypingTests.swift', 'Mac-only'],
  ])
})

test('only the upstream UIKit text field is excluded; accidentally copying it into Shared is detected', t => {
  const f = fixture(t)
  write(f.mac, 'Shared/Practice/PracticeTextField.swift', 'import UIKit\n')
  assert.deepEqual(f.check().differences.map(item => item.mac), ['Shared/Practice/PracticeTextField.swift'])
})

test('comparison and reporting leave both working trees byte-for-byte unchanged', t => {
  const f = fixture(t)
  write(f.iPad, 'ios/TypleCore/Sources/TypleCore/Typing.swift', 'let shared = 2\n')
  const before = [snapshot(f.mac), snapshot(f.iPad)]
  formatReport(f.check())
  assert.deepEqual([snapshot(f.mac), snapshot(f.iPad)], before)
})

test('the CLI uses TYPLE_R from any working directory and exits 0 or 1 without writes', t => {
  const f = fixture(t)
  for (const file of ['check-shared-swift.cjs', 'shared-swift-platform.patch']) {
    write(f.mac, `scripts/${file}`, fs.readFileSync(path.join(root, 'scripts', file)))
  }
  const command = () => spawnSync(process.execPath, [path.join(f.mac, 'scripts/check-shared-swift.cjs')], {
    cwd: os.tmpdir(), encoding: 'utf8', env: { ...process.env, TYPLE_R: f.iPad },
  })
  assert.equal(command().status, 0)
  write(f.iPad, 'ios/TypleCore/Sources/TypleCore/Typing.swift', 'let shared = 2\n')
  const before = [snapshot(f.mac), snapshot(f.iPad)]
  const result = command()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /\+let shared = 2/)
  assert.deepEqual([snapshot(f.mac), snapshot(f.iPad)], before)
})

test('missing configuration, invalid paths and tool failures are errors, not a pass', t => {
  const f = fixture(t)
  assert.throws(() => checkSharedSwift(), /Set TYPLE_R/)
  assert.throws(() => checkSharedSwift({ root: f.mac, typleR: path.join(f.iPad, 'missing') }), /ENOENT/)
  for (const typleR of ['', path.join(f.iPad, 'missing')]) {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, TYPLE_R: typleR } })
    assert.equal(result.status, 2)
    assert.match(result.stderr, /Shared Swift check failed:/)
  }
  const noGit = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, TYPLE_R: f.iPad, PATH: '' } })
  assert.equal(noGit.status, 2)
  assert.match(noGit.stderr, /ENOENT/)
})

test('shared Swift matches the configured typle-r checkout', {
  skip: !process.env.TYPLE_R && 'Set TYPLE_R to compare with the local iPad checkout; no cross-repository check was run.',
}, () => {
  const result = checkSharedSwift({ typleR: process.env.TYPLE_R })
  assert.equal(result.differences.length, 0, formatReport(result))
})
