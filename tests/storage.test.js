import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigStorage, CACHE_KEY, RECOVERY_KEY } from '../src/services/configStorage.js'
import { normalizeList, exportConfig } from '../src/domain/config.js'
import { t } from '../src/i18n/index.js'

const first = { id: 'jbswy3dpehpk3pxp', title: '工作 / 🔐' }
const second = { id: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', title: 'Second', algorithm: 'SHA512', digits: 8, period: 60 }
const legacy = { list: [first, second] }
const expected = {
    version: 1,
    list: [
        { secret: 'JBSWY3DPEHPK3PXP', title: first.title, algorithm: 'SHA1', digits: 6, period: 30 },
        { secret: second.id, title: second.title, algorithm: 'SHA512', digits: 8, period: 60 },
    ],
}
function area(initial = {}, name = 'sync', events = []) {
    const api = {
        data: structuredClone(initial), writes: 0, failSet: false, failRemove: false, onGet: undefined, onSet: undefined,
        async get(keys) {
            await api.onGet?.()
            const selection = keys === undefined ? Object.keys(api.data) : Array.isArray(keys) ? keys : [keys]
            return structuredClone(Object.fromEntries(selection.filter(key => Object.hasOwn(api.data, key)).map(key => [key, api.data[key]])))
        },
        async set(value) {
            events.push(name + '.set')
            if (api.failSet) throw Error('QUOTA_BYTES_PER_ITEM')
            await api.onSet?.(value)
            Object.assign(api.data, structuredClone(value)); api.writes++
        },
        async remove(key) {
            events.push(name + '.remove')
            if (api.failRemove) throw Error('CLEANUP_FAILED')
            delete api.data[key]
        },
    }
    return api
}
function web(initial) {
    const data = new Map(initial === undefined ? [] : [[CACHE_KEY, initial]])
    return { data, failSet: false, writes: 0,
        getItem(key) { return data.get(key) ?? null },
        setItem(key, value) { if (this.failSet) throw Error('WEB_QUOTA'); data.set(key, String(value)); this.writes++ },
        removeItem(key) { data.delete(key) },
    }
}
const repo = (sync, local = area({}, 'local'), locks) => createConfigStorage({ sync, local, locks, webStorage: undefined })

test('Chrome migration matches exports, journals before writing, preserves order/settings and unrelated keys', async () => {
    const events = [], sync = area({ ...legacy, unrelated: { enabled: true } }, 'sync', events), local = area({}, 'local', events)
    const storage = repo(sync, local)
    const state = await storage.load({ migrate: true })
    assert.deepEqual(state, { list: normalizeList(legacy), warning: false })
    assert.deepEqual(sync.data, { ...expected, unrelated: { enabled: true } })
    assert.deepEqual(expected, JSON.parse(exportConfig(legacy.list, 'json')))
    assert.deepEqual(events, ['local.set', 'sync.set', 'local.remove'])
    assert.equal(Object.hasOwn(local.data, RECOVERY_KEY), false)
    const writes = sync.writes
    await storage.load({ migrate: true })
    assert.equal(sync.writes, writes, 'an already migrated document is not rewritten')
})

test('local cache accepts legacy object/array and preserves the original text until verification', async () => {
    for (const raw of [legacy, legacy.list]) {
        const text = '\n' + JSON.stringify(raw, null, 2) + '\n', cache = web(text)
        const storage = createConfigStorage({ sync: undefined, local: undefined, webStorage: cache, locks: undefined })
        const state = await storage.load({ migrate: true })
        assert.equal(state.warning, false)
        assert.deepEqual(JSON.parse(cache.getItem(CACHE_KEY)), expected)
        assert.equal(cache.getItem(RECOVERY_KEY), null)
        assert.deepEqual(state.list, normalizeList(legacy))
        const writes = cache.writes
        await storage.load({ migrate: true })
        assert.equal(cache.writes, writes)
    }
})

test('migration failures preserve live legacy data and an exact recovery source, then retry safely', async () => {
    const sync = area(legacy), local = area(), storage = repo(sync, local)
    sync.failSet = true
    const state = await storage.load({ migrate: true })
    assert.equal(state.warning, true)
    assert.deepEqual(state.list, normalizeList(legacy))
    assert.deepEqual(sync.data, legacy)
    assert.deepEqual(local.data[RECOVERY_KEY], { version: 1, original: legacy, target: expected })
    assert.deepEqual(JSON.parse(exportConfig(state.list, 'json')), expected, 'view/export remain possible')
    sync.failSet = false
    assert.equal((await storage.load({ migrate: true })).warning, false)
    assert.deepEqual(sync.data, expected)
    assert.equal(Object.hasOwn(local.data, RECOVERY_KEY), false)
})

test('failed recovery checkpoint never writes Chrome sync; a blocked local cache is unchanged', async () => {
    const sync = area(legacy), local = area(), storage = repo(sync, local)
    local.failSet = true
    assert.equal((await storage.load({ migrate: true })).warning, true)
    assert.equal(sync.writes, 0)
    assert.deepEqual(sync.data, legacy)
    const text = JSON.stringify(legacy), cache = web(text)
    cache.failSet = true
    const browser = createConfigStorage({ sync: undefined, webStorage: cache, locks: undefined })
    assert.equal((await browser.load({ migrate: true })).warning, true)
    assert.equal(cache.getItem(CACHE_KEY), text)
})

test('oversized legacy data can still be reduced and saved without first completing migration', async () => {
    const sync = area(legacy), local = area(), storage = repo(sync, local)
    sync.onSet = value => { if (value.list.length > 1) throw Error('QUOTA_BYTES_PER_ITEM') }
    assert.equal((await storage.load({ migrate: true })).warning, true)
    const state = await storage.update(list => list.splice(1, 1))
    assert.equal(state.warning, false)
    assert.deepEqual(sync.data, { version: 1, list: [expected.list[0]] })
    assert.equal(Object.hasOwn(local.data, RECOVERY_KEY), false)
})

test('unknown versions, malformed data, unknown fields and conflicting aliases are never overwritten', async () => {
    const invalid = [null, { list: null }, { version: 2, list: legacy.list }, { version: 1 }, { list: [{ id: 'bad!' }] }, { ...legacy, future: true }, { list: [{ ...first, future: true }] }, { list: [{ ...first, secret: second.id }] }, { list: [{ ...first, name: 'Conflicting name' }] }]
    for (const value of invalid) {
        const cache = web(JSON.stringify(value)), before = cache.getItem(CACHE_KEY)
        const storage = createConfigStorage({ sync: undefined, webStorage: cache, locks: undefined })
        await assert.rejects(storage.load({ migrate: true }))
        await assert.rejects(storage.update(list => list.push(first)))
        assert.equal(cache.getItem(CACHE_KEY), before)
        assert.equal(cache.writes, 0)
    }
    const broken = web('{ broken')
    await assert.rejects(createConfigStorage({ sync: undefined, webStorage: broken }).load({ migrate: true }))
    assert.equal(broken.getItem(CACHE_KEY), '{ broken')
    const future = area({ version: 99, list: legacy.list }), local = area()
    await assert.rejects(repo(future, local).load({ migrate: true }), { message: t('invalidVersion') })
    assert.equal(future.writes, 0);assert.deepEqual(local.data, {})
})

test('empty current config is authoritative; missing data with a recovery journal is not silently reset', async () => {
    const empty = { version: 1, list: [] }, local = area({ [RECOVERY_KEY]: { version: 1, original: legacy, target: empty } }), sync = area(empty)
    assert.deepEqual((await repo(sync, local).load({ migrate: true })).list, [])
    assert.equal(sync.writes, 0)
    assert.deepEqual(local.data, {})
    const orphan = area({ [RECOVERY_KEY]: { version: 1, original: legacy, target: expected } })
    const missing = area()
    await assert.rejects(repo(missing, orphan).load({ migrate: true }))
    await assert.rejects(repo(missing, orphan).update(list => list.push(first)))
    assert.equal(missing.writes, 0)
    assert.ok(orphan.data[RECOVERY_KEY])
    const fresh = area(), freshStore = repo(fresh)
    assert.deepEqual((await freshStore.load({ migrate: true })).list, [])
    assert.equal(fresh.writes, 0)
    await freshStore.update(list => list.push(first))
    assert.deepEqual(fresh.data, { version: 1, list: [expected.list[0]] })
})

test('crash recovery verifies the expected target before discarding the old snapshot', async () => {
    const journal = { version: 1, original: legacy, target: expected }
    const local = area({ [RECOVERY_KEY]: journal }), sync = area(expected), storage = repo(sync, local)
    assert.equal((await storage.load({ migrate: true })).warning, false)
    assert.deepEqual(local.data, {})
    // A valid-looking partial list must not erase the only complete original snapshot.
    const partial = area({ version: 1, list: [expected.list[0]] }), backup = area({ [RECOVERY_KEY]: journal }), partialStore = repo(partial, backup)
    assert.equal((await partialStore.load({ migrate: true })).warning, true)
    await assert.rejects(partialStore.update(list => { list.length = 0 }))
    assert.deepEqual(backup.data[RECOVERY_KEY], journal)
    assert.equal(partial.writes, 0)
})

test('cleanup failure reports committed data accurately and is retried without rewriting it', async () => {
    const sync = area(legacy), local = area(), storage = repo(sync, local)
    local.failRemove = true
    const result = await storage.update(list => { list[0].title = 'Updated' })
    assert.equal(result.warning, true)
    assert.equal(result.list[0].title, 'Updated')
    assert.equal(sync.data.list[0].title, 'Updated')
    assert.ok(local.data[RECOVERY_KEY])
    const writes = sync.writes
    local.failRemove = false
    assert.equal((await storage.load({ migrate: true })).warning, false)
    assert.equal(sync.writes, writes)
    assert.deepEqual(local.data, {})
})

test('writes re-read the latest source and reject changes observed during checkpointing', async () => {
    const sync = area(expected), local = area(), storage = repo(sync, local)
    await storage.load({ migrate: true })
    sync.data.list.push({ secret: 'MZXW6YTBOI', title: 'Remote', algorithm: 'SHA1', digits: 6, period: 30 })
    await storage.update(list => { list[0].title = 'Renamed' })
    assert.equal(sync.data.list.length, 3)
    assert.equal(sync.data.list[2].title, 'Remote')
    const legacySync = area(legacy), recovery = area()
    recovery.onSet = () => { legacySync.data.list.push({ id: 'MZXW6YTBOI', title: 'Arrived during migration' }) }
    assert.equal((await repo(legacySync, recovery).load({ migrate: true })).warning, true)
    assert.equal(legacySync.writes, 0)
    assert.equal(legacySync.data.list.length, 3)
})

test('Web Locks serialize independent clients; failed writes do not poison later operations', async () => {
    let queue = Promise.resolve(), locksUsed = 0
    const locks = { request(name, action) { assert.equal(name, CACHE_KEY);locksUsed++;const result=queue.then(action);queue=result.catch(()=>{});return result } }
    const sync = area({ version: 1, list: [] }), local = area(), a = repo(sync, local, locks), b = repo(sync, local, locks)
    await Promise.all([a.update(list => list.push(first)), b.update(list => list.push(second))])
    assert.deepEqual(sync.data.list.map(item => item.secret), expected.list.map(item => item.secret))
    sync.failSet = true
    await assert.rejects(a.update(list => { list.length = 0 }), /QUOTA/)
    assert.equal(sync.data.list.length, 2)
    sync.failSet = false
    await a.update(list => { list[0].title = 'After retry' })
    assert.equal(sync.data.list[0].title, 'After retry')
    assert.equal(locksUsed, 4)
})

test('migration retains duplicate rows and accepts equivalent old/new secret aliases without dropping settings', async () => {
    const duplicate = { list: [first, { ...first, title: 'Another label', algorithm: 'SHA256', digits: 8, period: 45 }] }
    const sync = area(duplicate), storage = repo(sync)
    const state = await storage.load({ migrate: true })
    assert.equal(state.list.length, 2)
    assert.deepEqual(sync.data.list.map(item => item.title), [first.title, 'Another label'])
    assert.deepEqual(sync.data.list[1], { secret: first.id.toUpperCase(), title: 'Another label', algorithm: 'SHA256', digits: 8, period: 45 })
    const aliases = area({ version: 1, list: [{ ...first, secret: first.id.toUpperCase() }] })
    assert.equal((await repo(aliases).load({ migrate: true })).warning, false)
    assert.deepEqual(aliases.data, { version: 1, list: [expected.list[0]] })
})

test('readback failures and malformed recovery metadata retain the recovery source', async () => {
    const sync = area(legacy), local = area(), storage = repo(sync, local)
    sync.onGet = () => { if (sync.writes) throw Error('READBACK_FAILED') }
    assert.equal((await storage.load({ migrate: true })).warning, true)
    assert.deepEqual(local.data[RECOVERY_KEY].original, legacy)
    assert.deepEqual(sync.data, expected)
    sync.onGet = undefined
    assert.equal((await storage.load({ migrate: true })).warning, false)
    assert.deepEqual(local.data, {})
    for (const bad of [null, false, {}, { version: 2 }, { version: 1, original: '{ broken', target: expected }, { version: 1, original: { list: [{ ...first, future: true }] }, target: expected }, { version: 1, original: legacy, target: { version: 99, list: [] } }]) {
        const data = area(expected), recovery = area({ [RECOVERY_KEY]: bad }), client = repo(data, recovery)
        assert.equal((await client.load({ migrate: true })).warning, true)
        await assert.rejects(client.update(list => { list.length = 0 }))
        assert.deepEqual(recovery.data[RECOVERY_KEY], bad)
        assert.equal(data.writes, 0)
    }
})
