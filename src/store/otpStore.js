import { t } from '../i18n/index.js'
import { readonly, ref } from 'vue'
import { normalizeAccount, requireTitle } from '../domain/otp.js'
import { normalizeList } from '../domain/config.js'
import { createConfigStorage } from '../services/configStorage.js'

const otps = ref([])
const ready = ref(false)
const warning = ref(false)
const storage = createConfigStorage()
let pending = Promise.resolve()
const serial = action => {
    const result = pending.then(action)
    pending = result.catch(() => {})
    return result
}
function publish(state) {
    otps.value = state.list
    warning.value = state.warning
}
function initialize() {
    return serial(async () => {
        ready.value = false
        publish(await storage.load({ migrate: true }))
        ready.value = true
    })
}

function mutate(change) {
    return serial(async () => {
        if (!ready.value) throw new Error(t('notReady'))
        const state = await storage.update(change)
        publish(state)
        return state.result
    })
}

export const useOtpStore = () => ({
    otps: readonly(otps), ready: readonly(ready), warning: readonly(warning), initialize,
    addMany(values) {
        const accounts = normalizeList(values)
        return mutate(list => {
            let added = 0
            for (const account of accounts) {
                if (!list.some(item => item.id === account.id)) { list.push(account); added++ }
            }
            return { added, skipped: accounts.length - added }
        })
    },
    update(id, value) {
        const account = normalizeAccount({ ...value, title: requireTitle(value?.title) })
        return mutate(list => {
            const index = list.findIndex(item => item.id === id)
            if (index < 0) throw new Error(t('accountMissing'))
            if (list.some((item, position) => position !== index && item.id === account.id)) throw new Error(t('duplicateSecret'))
            list[index] = account
        })
    },
    rename(id, title) {
        title = requireTitle(title)
        return mutate(list => {
            const index = list.findIndex(item => item.id === id)
            if (index >= 0) list[index] = normalizeAccount({ ...list[index], title })
        })
    },
    remove(id) {
        return mutate(list => {
            const index = list.findIndex(item => item.id === id)
            if (index >= 0) list.splice(index, 1)
        })
    },
    move(id, targetId) {
        return mutate(list => {
            const from = list.findIndex(item => item.id === id)
            const to = list.findIndex(item => item.id === targetId)
            if (from >= 0 && to >= 0 && from !== to) list.splice(to, 0, list.splice(from, 1)[0])
        })
    },
})
