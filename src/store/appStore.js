import { reactive, readonly, ref, watch } from "vue"

const clean = async _ => await chrome.storage.sync.clear()
const getStorage = async _ => await chrome.storage.sync.get()
const setStorage = async store => await chrome.storage.sync.set(store)

const otps = ref([])


watch(otps, async _ => {
    await setStorage({ list:[...otps.value] })
}, { deep: true })


export const useAppStore = () => {
    return {
        otps: readonly(otps),
        clean,
        async init() {
            let store = await getStorage()
            otps.value = store.list ?? []
        },
        add(obj) {
            otps.value.push(obj)
        },
        del(i) {
            otps.value.splice(i, 1)
        },
    }
}
