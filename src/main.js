import { createVaporApp } from 'vue'
import App from './App.vue'
import { initializeI18n, currentLocale } from './i18n/index.js'
import './style/index.css'

await initializeI18n()
document.documentElement.lang = currentLocale()
document.documentElement.dir = currentLocale() === 'ar' ? 'rtl' : 'ltr'

createVaporApp(App).mount('#app')
