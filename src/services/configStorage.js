import { normalizeList, toConfig, CONFIG_VERSION, CONFIG_FIELDS } from '../domain/config.js'
import { normalizeSecret } from '../domain/otp.js'
import { t } from '../i18n/index.js'

export const CACHE_KEY = 'auto-mfa'
export const RECOVERY_KEY = 'auto-mfa:migration-backup'
const RECOVERY_VERSION = 1
const legacyFields = new Set([...CONFIG_FIELDS, 'id', 'name'])
const has = (value, key) => Object.hasOwn(value, key)

function decode(raw, missing) {
    if (missing) return { list: [], canonical: false, missing: true }
    // An unknown schema must never be mistaken for an empty or older document.
    if (!Array.isArray(raw) && raw?.version !== undefined && raw.version !== CONFIG_VERSION) throw new Error(t('invalidVersion'))
    if (!Array.isArray(raw) && (!raw || typeof raw !== 'object' || Object.keys(raw).some(key => !['version', 'list'].includes(key)))) throw new Error(t('invalidAccount'))
    const list = normalizeList(raw)
    const records = Array.isArray(raw) ? raw : raw.list
    for (const record of records) {
        if (Object.keys(record).some(key => !legacyFields.has(key))) throw new Error(t('invalidAccount'))
        if (record.id != null && record.secret != null && normalizeSecret(record.id) !== normalizeSecret(record.secret)) throw new Error(t('invalidAccount'))
        if (record.title != null && record.name != null && (typeof record.name !== 'string' || record.title.trim() !== record.name.trim())) throw new Error(t('invalidAccount'))
    }
    const config = toConfig(list)
    const canonical = raw.version === CONFIG_VERSION && records.every((record, index) => Object.keys(record).length === CONFIG_FIELDS.length && CONFIG_FIELDS.every(key => record[key] === config.list[index][key]))
    return { list, config, canonical, missing: false }
}

// The same logical document is used by Chrome sync, localStorage and JSON exports.
// Chrome stores version/list as separate keys in one bulk write, preserving unrelated keys.
export function createConfigStorage({ sync = globalThis.chrome?.storage?.sync, local = globalThis.chrome?.storage?.local, webStorage, locks = globalThis.navigator?.locks } = {}) {
    const cache = () => webStorage ?? globalThis.localStorage
    let pending = Promise.resolve()
    const serial = action => {
        const result = pending.then(() => locks ? locks.request(CACHE_KEY, action) : action())
        pending = result.catch(() => {})
        return result
    }
    async function snapshot() {
        if (sync) {
            const raw = await sync.get(['version', 'list'])
            return { raw, missing: !has(raw, 'version') && !has(raw, 'list') }
        }
        const text = cache().getItem(CACHE_KEY)
        return { raw: text === null ? null : JSON.parse(text), missing: text === null, text }
    }
    async function save(config) {
        if (sync) await sync.set(config)
        else cache().setItem(CACHE_KEY, JSON.stringify(config))
    }
    async function recoveryExists() {
        return sync ? !!local && has(await local.get(RECOVERY_KEY), RECOVERY_KEY) : cache().getItem(RECOVERY_KEY) !== null
    }
    async function currentState(before) {
        const state = decode(before.raw, before.missing)
        if (state.missing && await recoveryExists()) throw new Error(t('storageMaintenancePending'))
        return state
    }
    async function unchanged(before) {
        const current = await snapshot()
        if (current.missing !== before.missing || JSON.stringify(current.raw) !== JSON.stringify(before.raw)) throw new Error(t('storageChanged'))
    }
    async function recovery() {
        if (sync) return local ? (await local.get(RECOVERY_KEY))[RECOVERY_KEY] : undefined
        const text = cache().getItem(RECOVERY_KEY)
        return text === null ? undefined : JSON.parse(text)
    }
    function recoveryConfig(journal, key) {
        if (journal?.version !== RECOVERY_VERSION) throw new Error(t('storageMaintenancePending'))
        const raw = key === 'original' && typeof journal[key] === 'string' ? JSON.parse(journal[key]) : journal[key]
        return decode(raw, false).config
    }
    const sameConfig = (left, right) => JSON.stringify(left) === JSON.stringify(right)
    async function checkpoint(before, target) {
        const previous = await recovery()
        if (previous !== undefined && !sameConfig(recoveryConfig(previous, 'original'), decode(before.raw, false).config)) throw new Error(t('storageMaintenancePending'))
        const journal = { version: RECOVERY_VERSION, original: sync ? before.raw : before.text, target }
        if (sync) {
            if (!local) throw new Error(t('storageMaintenancePending'))
            await local.set({ [RECOVERY_KEY]: journal })
        } else cache().setItem(RECOVERY_KEY, JSON.stringify(journal))
    }
    async function cleanRecovery(config) {
        const journal = await recovery()
        if (journal === undefined) return
        // A crash or a partial write must not discard the only intact old snapshot.
        recoveryConfig(journal, 'original')
        if (!sameConfig(recoveryConfig(journal, 'target'), config)) throw new Error(t('storageMaintenancePending'))
        if (sync) await local.remove(RECOVERY_KEY)
        else cache().removeItem(RECOVERY_KEY)
    }
    async function verifyAndClean(config) {
        const after = await snapshot()
        const state = decode(after.raw, after.missing)
        if (!state.canonical || JSON.stringify(state.config) !== JSON.stringify(config)) return false
        await cleanRecovery(config)
        return true
    }
    return {
        load({ migrate = false } = {}) {
            return serial(async () => {
                const before = await snapshot()
                const state = await currentState(before)
                if (!migrate || state.missing) return { list: state.list, warning: false }
                try {
                    if (!state.canonical) {
                        await checkpoint(before, state.config)
                        await unchanged(before)
                        await save(state.config)
                        return { list: state.list, warning: !await verifyAndClean(state.config) }
                    }
                    await cleanRecovery(state.config)
                    return { list: state.list, warning: false }
                } catch { return { list: state.list, warning: true } }
            })
        },
        update(change) {
            return serial(async () => {
                // Read again inside the lock: another popup or sync event may have added accounts.
                const before = await snapshot()
                const state = await currentState(before)
                const result = change(state.list)
                const config = toConfig(state.list)
                const migrating = !state.missing && !state.canonical
                if (migrating) await checkpoint(before, config)
                else await cleanRecovery(state.config)
                await unchanged(before)
                await save(config)
                let warning = false
                if (migrating) {
                    // A cleanup/readback failure does not undo an already successful save.
                    try { warning = !await verifyAndClean(config) } catch { warning = true }
                }
                return { list: normalizeList(config), result, warning }
            })
        },
    }
}
