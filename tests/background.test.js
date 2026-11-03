import { t } from '../src/i18n/index.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateCode } from '../src/domain/otp.js'
const list = [
    { id: 'jbswy3dpehpk3pxp', title: '第一项' },
    { id: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', title: '第二项', algorithm: 'SHA256', digits: 8, period: 60 },
]
const menus = []
let clicked, changed, installed, execution, version
const recovery = new Map()
const settle = () => new Promise(resolve => setTimeout(resolve, 10))
globalThis.chrome = {
    storage: { local: {
        async get(key) { return recovery.has(key) ? { [key]: recovery.get(key) } : {} },
        async set(values) { for (const [key, value] of Object.entries(values)) recovery.set(key, structuredClone(value)) },
        async remove(key) { recovery.delete(key) },
    }, sync: {
        async get() { return structuredClone({ ...(version === undefined ? {} : { version }), list }) },
        async set(value) { version = value.version;list.splice(0, list.length, ...structuredClone(value.list)) },
    }, onChanged: { addListener(fn) { changed = fn } } },
    runtime: { onInstalled: { addListener(fn) { installed = fn } }, onStartup: { addListener() {} } },
    contextMenus: {
        async removeAll() { menus.length = 0 },
        create(item, callback) { menus.push(item); callback(); return item.id },
        onClicked: { addListener(fn) { clicked = fn } },
    },
    scripting: { async executeScript(options) { execution = options } },
}
await import('../src/chrome/background.js')

test('context menus follow list order and autofill awaits code generation with custom settings', async () => {
    await settle()
    assert.deepEqual(menus.map(menu => menu.title), ['第一项', '第二项'])
    assert.equal(menus[0].id, list[0].id.toUpperCase())
    const oldNow = Date.now
    Date.now = () => 1234567890000
    try {
        await clicked({ menuItemId: list[1].id, frameId: 12 }, { id: 7 })
        assert.deepEqual(execution.target, { tabId: 7, frameIds: [12] })
        assert.equal(execution.args[0], await generateCode(list[1]))
        assert.match(execution.args[0], /^\d{8}$/)
        await clicked({ menuItemId: list[0].id.toUpperCase() }, { id: 7 })
        assert.match(execution.args[0], /^\d{6}$/)
    } finally { Date.now = oldNow }
    list.reverse()
    changed({ list: {} }, 'sync')
    await settle()
    assert.deepEqual(menus.map(menu => menu.title), ['第二项', '第一项'])
})

test('legacy unnamed entries receive normalized titles without a background fallback', async () => {
    list.push({ id: 'MZXW6YTBOI', title: '' })
    changed({ list: {} }, 'sync')
    await settle()
    assert.equal(menus.at(-1).title, t('unnamed'))
    assert.equal(menus.length, 3)
})


test('installation/upgrade migrates before refreshing menus; the worker reads canonical secrets', async () => {
    await installed()
    await settle()
    assert.equal(version, 1)
    assert.ok(list.every(item => typeof item.secret === 'string' && !Object.hasOwn(item, 'id')))
    assert.equal(recovery.size, 0)
    const oldNow = Date.now
    Date.now = () => 1234567890000
    try {
        await clicked({ menuItemId: list[0].secret }, { id: 9 })
        assert.equal(execution.args[0], await generateCode(list[0]))
    } finally { Date.now = oldNow }
})

test('future schema events never erase existing menus or run autofill against an unsupported format', async () => {
    const before = structuredClone(menus), previous = execution, oldError = console.error
    const errors = []
    console.error = (...args) => errors.push(args)
    try {
        version = 99
        changed({ version: { newValue: 99 } }, 'sync')
        await settle()
        assert.deepEqual(menus, before)
        await clicked({ menuItemId: list[0].secret }, { id: 9 })
        assert.equal(execution, previous)
        assert.equal(version, 99)
        assert.equal(errors.length, 2)
    } finally { version = 1;console.error = oldError }
})
