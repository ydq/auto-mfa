import { ref, watch } from "vue"

const themeMedia = window.matchMedia("(prefers-color-scheme: dark)")
const isDark = ref(themeMedia.matches)
themeMedia.addEventListener('change', e => isDark.value = e.matches)
watch(isDark, dark => {
    document.body.classList[dark ? 'add' : 'remove']('lew-dark')
}, { immediate: true })