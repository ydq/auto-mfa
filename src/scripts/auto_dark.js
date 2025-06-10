import { ref, watch } from "vue"

const themeMedia = window.matchMedia("(prefers-color-scheme: dark)")
const isDark = ref(themeMedia.matches)
themeMedia.addEventListener('change', e => isDark.value = e.matches)
watch(isDark, dark => {
    if (dark) {
        document.body.setAttribute('arco-theme', 'dark')
    } else {
        document.body.removeAttribute('arco-theme');
    }
}, { immediate: true })