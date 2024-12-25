import { createApp } from 'vue'
import App from './App.vue'
import { LewTooltip } from 'lew-ui'
import "lew-ui/style"
import './style/index.css'

createApp(App)
.use(LewTooltip)
.mount('#app')
