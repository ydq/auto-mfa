import { t } from '../src/i18n/index.js'
import test from 'node:test'
import assert from 'node:assert/strict'
const first = { id: 'JBSWY3DPEHPK3PXP', title: '已有配置' }
const second = { id: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', title: '第二项' }
let saved = { list: [first] }
let failWrite = false
let writes = 0
const recovery = new Map()
globalThis.chrome = { storage: { local: {
    async get(key) { return recovery.has(key) ? { [key]: structuredClone(recovery.get(key)) } : {} },
    async set(value) { for (const [key, item] of Object.entries(value)) recovery.set(key, structuredClone(item)) },
    async remove(key) { recovery.delete(key) },
}, sync: {
    async get() { return structuredClone(saved) },
    async set(value) {
        if (failWrite) throw new Error('QUOTA_BYTES_PER_ITEM')
        writes++
        saved = structuredClone(value)
    },
} } }
const { useOtpStore } = await import('../src/store/otpStore.js')
const store = useOtpStore()

test('legacy migration, deduplication, serialized writes, durable order and quota rollback', async () => {
    await store.initialize()
    assert.equal(store.otps.value[0].period, 30)
    assert.deepEqual(await store.addMany([first, second, second]), { added: 1, skipped: 2 })
    await Promise.all([store.rename(first.id, '已修改'), store.move(second.id, first.id)])
    assert.deepEqual(saved.list.map(item => item.title), ['第二项', '已修改'])
    await store.initialize()
    assert.equal(store.otps.value[0].id, second.id)
    failWrite = true
    const before = JSON.stringify(store.otps.value)
    await assert.rejects(store.remove(first.id), /QUOTA/)
    assert.equal(JSON.stringify(store.otps.value), before)
    failWrite = false
    await store.remove(first.id)
    assert.equal(saved.list.length, 1)
    const beforeWrites = writes
    assert.throws(() => store.addMany([first, { id: 'bad!' }]))
    assert.equal(writes, beforeWrites)
    assert.equal(store.otps.value.length, 1)
})

test('editing replaces all settings in place, rejects duplicates and rolls back failed saves', async () => {
    saved = { list: [first, second] }
    await store.initialize()
    const edited = { id: 'MZXW6YTBOI', title: '已编辑', algorithm: 'SHA512', digits: 8, period: 60 }
    const before = JSON.stringify(store.otps.value)
    const beforeWrites = writes
    await assert.rejects(store.update(first.id, second), { message: t('duplicateSecret') })
    assert.equal(writes, beforeWrites)
    assert.equal(JSON.stringify(store.otps.value), before)
    failWrite = true
    await assert.rejects(store.update(first.id, edited), /QUOTA/)
    assert.equal(JSON.stringify(store.otps.value), before)
    failWrite = false
    await store.update(first.id, edited)
    assert.deepEqual(saved.list[0], { secret: edited.id, title: edited.title, algorithm: edited.algorithm, digits: edited.digits, period: edited.period })
    assert.equal(saved.list[1].secret, second.id)
    assert.equal(saved.list.length, 2)
    await store.initialize()
    assert.deepEqual({ ...store.otps.value[0] }, edited)
    const afterWrites = writes
    await assert.rejects(store.update(first.id, edited), { message: t('accountMissing') })
    assert.throws(() => store.update(edited.id, { id: 'invalid!' }))
    assert.equal(writes, afterWrites)
})

test('empty and whitespace-only names cannot replace a saved title', async () => {
    saved = { list: [first] }
    await store.initialize()
    const before = JSON.stringify(saved)
    const beforeWrites = writes
    for (const title of ['', '   ', '\t\n']) {
        assert.throws(() => store.rename(first.id, title), { message: t('titleRequired') })
        assert.throws(() => store.update(first.id, { ...first, title }), { message: t('titleRequired') })
    }
    assert.equal(JSON.stringify(saved), before)
    assert.equal(writes, beforeWrites)
})

test('unsupported storage versions keep the previous in-memory data and disable mutations until a valid reload', async () => {
    saved = { list: [first] }
    await store.initialize()
    const previous = JSON.stringify(store.otps.value), beforeWrites = writes
    const future = { version: 2, list: [{ secret: second.id, futureField: 'keep' }] }
    saved = structuredClone(future)
    await assert.rejects(store.initialize(), { message: t('invalidVersion') })
    assert.equal(store.ready.value, false)
    assert.equal(JSON.stringify(store.otps.value), previous)
    await assert.rejects(store.remove(first.id), { message: t('notReady') })
    assert.deepEqual(saved, future)
    assert.equal(writes, beforeWrites)
    saved = { list: [first] }
    await store.initialize()
    assert.equal(store.ready.value, true)
    assert.equal(store.warning.value, false)
})
