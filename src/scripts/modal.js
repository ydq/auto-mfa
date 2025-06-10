import { Modal } from '@arco-design/web-vue'
import '@arco-design/web-vue/es/modal/style/css.js'

const open = (method, options) => Modal[method]({
    width: '200px',
    hideTitle: true,
    ...options
})
const info = opts => {
    open("info", opts)
}
const confirm = opts => {
    open("confirm", opts)
}
export { info, confirm }