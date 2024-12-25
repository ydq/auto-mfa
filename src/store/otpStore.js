import { readonly, ref, watch } from "vue"

const getStorage = async _ => await chrome.storage.sync.get()
const setStorage = async store => await chrome.storage.sync.set(store)

const otps = ref([])
otps.value = (await getStorage())?.list ?? []

watch(otps, async _ => {
    await setStorage({ list:[...otps.value] })
}, { deep: true })

export const useOtpStore = () => {
    return {
        otps: readonly(otps),
        async clean(){
            await chrome.storage.sync.clear()
        },
        add(otp) {
            otps.value.push(otp)
        },
        del(i) {
            otps.value.splice(i, 1)
        },
    }
}
