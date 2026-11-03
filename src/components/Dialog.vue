<script setup vapor>
import { t } from '../i18n/index.js'
import { ref, watch, nextTick, onMounted, onBeforeUnmount, useId } from 'vue'
const props = defineProps({ title: String, mode: String })
const emit = defineEmits(['close', 'resize'])
const element = ref()
const titleId = useId()
const header = ref()
const content = ref()
let observer, frame, lastHeight = 0
function fitPage() {
    if (!['add', 'edit', 'export', 'qr'].includes(props.mode) || !element.value?.isConnected) return
    const dialog = element.value
    const style = getComputedStyle(dialog)
    const insets = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + parseFloat(style[key]), 0)
    const gutter = Math.max(12, (innerWidth - dialog.getBoundingClientRect().width) / 2)
    const naturalHeight = header.value.getBoundingClientRect().height + parseFloat(getComputedStyle(header.value).marginBottom) + content.value.getBoundingClientRect().height + insets
    const height = Math.min(600, Math.ceil(naturalHeight + gutter * 2))
    if (height !== lastHeight) { lastHeight = height; emit('resize', height) }
}
function scheduleFit() {
    cancelAnimationFrame(frame)
    // Never resize the page within ResizeObserver delivery: Chrome reports a loop when that resizes the observed dialog.
    frame = requestAnimationFrame(fitPage)
}
watch(() => props.mode, async () => { lastHeight = 0; await nextTick(); scheduleFit() })
onMounted(() => {
    element.value.showModal()
    fitPage()
    observer = new ResizeObserver(scheduleFit)
    // Measure intrinsic content, not the viewport-constrained dialog box.
    observer.observe(header.value)
    observer.observe(content.value)
})
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame); element.value?.close() })
</script>

<template>
    <dialog ref="element" class="dialog" :class="{ 'qr-dialog': mode === 'qr', 'confirmation-dialog': mode === 'confirm-edit' }" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
        <header ref="header" class="dialog-header">
            <h2 :id="titleId">{{ title }}</h2>
            <slot name="actions"><button class="icon-button close-button" type="button" :aria-label="t('close')" @click="emit('close')"></button></slot>
        </header>
        <div ref="content"><slot /></div>
    </dialog>
</template>
