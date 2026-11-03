<script setup vapor>
import { t } from './i18n/index.js'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useOtpStore } from './store/otpStore.js'
import { generateCode, toOtpUri } from './domain/otp.js'
import { importConfig, exportConfig } from './domain/config.js'
import OtpItems from './components/OtpItems.vue'
import Dialog from './components/Dialog.vue'
import AccountForm from './components/AccountForm.vue'

const store = useOtpStore()
const { otps, ready, warning: storageWarning } = store
const panel = ref('')
const dialogHeight = ref(0)
watch(panel, () => { dialogHeight.value = 0 }, { flush: 'sync' })
const busy = ref(false)
const loadError = ref('')
const notice = ref(null)
const noticeShown = ref(false)
const imageInput = ref()
const configInput = ref()
const toolbarMenu = ref()
const draggedFile = ref(false)
const selected = ref(null)
const qrUrl = ref('')
const qrFilename = computed(() => {
    const title = (selected.value?.title || 'MFA').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180).replace(/[. ]+$/, '')
    return `${title || 'MFA'}.png`
})
const format = ref('json')
const titles = { add: 'addTitle', edit: 'editTitle', export: 'exportTitle', qr: 'qrTitle', delete: 'deleteTitle' }
const dialogTitle = computed(() => titles[panel.value] ? t(titles[panel.value]) : '')
let noticeTimer
let dragDepth = 0
watch(storageWarning, warning => {
    if (warning) notify(t('storageMaintenancePending'), true)
    else if (notice.value?.message === t('storageMaintenancePending')) noticeShown.value = false
})

function notify(message, error = false) {
    clearTimeout(noticeTimer)
    notice.value = { message, error }
    noticeShown.value = true
    if (!error) noticeTimer = setTimeout(() => { noticeShown.value = false }, 4000)
}
function notifySaved(message) {
    notify(storageWarning.value ? t('storageMaintenancePending') : message, storageWarning.value)
}
async function run(action) {
    if (busy.value) return
    busy.value = true
    try { await action() }
    catch (error) { notify(error.message || t('operationFailed'), true) }
    finally { busy.value = false }
}
async function load() {
    loadError.value = ''
    try { await store.initialize() }
    catch { loadError.value = t('loadFailed') }
}
function openAdd() {
    notice.value = null
    noticeShown.value = false
    panel.value = 'add'
}
function close() { if (!busy.value) panel.value = '' }
function reportImport({ added, skipped }) {
    notifySaved(t('importResult', { added }) + (skipped ? t('importSkipped', { skipped }) : ''))
}
function openEdit(item) {
    selected.value = item
    notice.value = null
    noticeShown.value = false
    panel.value = 'edit'
}
function saveAccount(account) {
    return run(async () => {
        if (panel.value === 'edit') {
            await store.update(selected.value.id, account)
            notifySaved(t('updated'))
        } else { reportImport(await store.addMany([account])) }
        panel.value = ''
    })
}

function readImages(files) {
    if (!ready.value || !files.length) return
    return run(async () => {
        const { readQrFiles } = await import('./services/qr.js')
        reportImport(await store.addMany(await readQrFiles(files)))
        panel.value = ''
    })
}
async function chooseImages(event) {
    await readImages([...event.target.files])
    event.target.value = ''
}
async function chooseConfig(event) {
    const file = event.target.files[0]
    await run(async () => {
        if (!file) return
        if (file.size > 2 * 1024 * 1024) throw new Error(t('fileTooLarge'))
        reportImport(await store.addMany(importConfig(await file.text())))
    })
    event.target.value = ''
}
function download() {
    return run(async () => {
        const content = exportConfig(otps.value, format.value)
        const types = { json: ['application/json', 'json'], yaml: ['application/yaml', 'yaml'], xml: ['application/xml', 'xml'] }
        const [type, extension] = types[format.value]
        const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }))
        const link = document.createElement('a')
        link.href = url
        link.download = `auto-mfa-${new Date().toISOString().slice(0, 10)}.${extension}`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        panel.value = ''
        notify(t('exported'))
    })
}
async function rename(id, title, settled) {
    try { await store.rename(id, title) }
    catch (error) { notify(error.message || t('renameFailed'), true) }
    finally { settled?.(); if (storageWarning.value) notifySaved() }
}

function move(id, target, settled) {
    return run(async () => { await store.move(id, target); if (storageWarning.value) notifySaved() }).finally(() => settled?.())
}
function prepareToolbar(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    toolbarMenu.value.style.top = `${rect.bottom + 6}px`
    const rtl = document.documentElement.dir === 'rtl'
    toolbarMenu.value.style.left = rtl ? `${Math.max(12, rect.left)}px` : 'auto'
    toolbarMenu.value.style.right = rtl ? 'auto' : `${Math.max(12, innerWidth - rect.right)}px`
}
function importFromMenu() { toolbarMenu.value.hidePopover(); configInput.value.click() }
function exportFromMenu() { toolbarMenu.value.hidePopover(); panel.value = 'export' }
function copy(item) {
    return run(async () => {
        const code = await generateCode(item)
        try { await navigator.clipboard.writeText(code); notify(t('copied')) }
        catch { notify(t('clipboardFailed', { code }), true) }
    })
}
function showQr(item) {
    return run(async () => {
        const { default: QRCode } = await import('qrcode')
        qrUrl.value = await QRCode.toDataURL(toOtpUri(item), { width: 280, margin: 4 })
        selected.value = item
        panel.value = 'qr'
    })
}
function askDelete(item) { selected.value = item; panel.value = 'delete' }
function remove() {
    return run(async () => {
        await store.remove(selected.value.id)
        panel.value = ''
        notifySaved(t('deleted'))
    })
}
const isFileDrag = event => [...event.dataTransfer.types].includes('Files')
function dragEnter(event) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth++
    draggedFile.value = true
}
function dragLeave(event) {
    if (!isFileDrag(event)) return
    if (--dragDepth <= 0) { dragDepth = 0; draggedFile.value = false }
}
function dragOver(event) { if (isFileDrag(event)) event.preventDefault() }
function drop(event) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth = 0
    draggedFile.value = false
    readImages([...event.dataTransfer.files])
}
function paste(event) {
    const images = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'))
    if (images.length) { event.preventDefault(); readImages(images) }
}
onMounted(() => {
    load()
    window.addEventListener('dragenter', dragEnter)
    window.addEventListener('dragleave', dragLeave)
    window.addEventListener('dragover', dragOver)
    window.addEventListener('drop', drop)
    window.addEventListener('paste', paste)
})
onBeforeUnmount(() => {
    clearTimeout(noticeTimer)
    window.removeEventListener('dragenter', dragEnter)
    window.removeEventListener('dragleave', dragLeave)
    window.removeEventListener('dragover', dragOver)
    window.removeEventListener('drop', drop)
    window.removeEventListener('paste', paste)
})
</script>

<template>
    <main class="app-shell" :class="panel ? `panel-${panel}` : ''" :style="{ minHeight: dialogHeight ? `${dialogHeight}px` : undefined, height: dialogHeight ? `${dialogHeight}px` : undefined, overflow: dialogHeight ? 'hidden' : undefined }" :aria-busy="busy">
        <header class="app-header">
            <div class="brand"><img src="/icon.svg" alt="" width="28" height="28" /><h1>AUTO MFA</h1></div>
            <div class="toolbar-group" role="group" :aria-label="t('manage')">
                <button class="add-button" :disabled="!ready || busy" @click="openAdd"><span aria-hidden="true">＋</span>{{ t('add') }}</button>
                <span class="toolbar-divider" aria-hidden="true"></span>
                <button class="icon-button toolbar-more" :disabled="!ready || busy" :aria-label="t('more')" :title="t('more')" popovertarget="toolbar-menu" @click="prepareToolbar"><span class="ellipsis" aria-hidden="true"><i></i><i></i><i></i></span></button>
            </div>
        </header>

        <div v-if="loadError" class="empty-state" role="alert"><p>{{ loadError }}</p><button class="secondary-button" @click="load">{{ t('reload') }}</button></div>
        <div v-else-if="!ready" class="empty-state" role="status">{{ t('loading') }}</div>
        <OtpItems v-else-if="otps.length" :otps="otps" @rename="rename" @copy="copy" @qr="showQr" @edit="openEdit" @delete="askDelete" @move="move" />
        <div v-else class="empty-state">
            <h2>{{ t('emptyTitle') }}</h2>
            <p>{{ t('emptyHint') }}</p>
        </div>
        <div ref="toolbarMenu" id="toolbar-menu" class="floating-menu toolbar-menu" popover="auto" :aria-label="t('backupActions')">
            <button class="text-button" :disabled="!ready || busy" @click="importFromMenu"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v10m-4-4 4 4 4-4M3 12v5h14v-5" /></svg>{{ t('importTitle') }}</button>
            <button class="text-button" :disabled="!ready || busy || !otps.length" @click="exportFromMenu"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 12V2m-4 4 4-4 4 4M3 12v5h14v-5" /></svg>{{ t('exportTitle') }}</button>
        </div>
        <div class="notice" :class="{ shown: noticeShown && !panel, error: notice?.error }" :role="notice?.error ? 'alert' : 'status'" :aria-hidden="!noticeShown || !!panel">
            <span>{{ notice?.message }}</span><button class="icon-button close-button" :aria-label="t('closeNotice')" @click="noticeShown = false"></button>
        </div>
        <div v-if="busy" class="busy-note" role="status">{{ t('processing') }}</div>
        <div v-if="draggedFile" class="file-overlay">{{ t('dropQr') }}</div>
        <input ref="imageInput" class="hidden" type="file" accept="image/*" multiple @change="chooseImages" />
        <input ref="configInput" class="hidden" type="file" accept=".json,.yaml,.yml,.xml,application/json,application/yaml,text/yaml,application/xml,text/xml" @change="chooseConfig" />
        <Dialog v-if="panel" :title="dialogTitle" :mode="panel" @close="close" @resize="dialogHeight = $event">
            <template v-if="panel === 'qr'" #actions>
                <div class="toolbar-group qr-controls" role="group" :aria-label="t('qrActions')">
                    <a class="qr-download" :href="qrUrl" :download="qrFilename" :aria-label="t('saveQr')" :title="t('saveQr')"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v10m-4-4 4 4 4-4M3 12v5h14v-5" /></svg>{{ t('save') }}</a>
                    <span class="toolbar-divider" aria-hidden="true"></span>
                    <button class="icon-button close-button" type="button" :aria-label="t('close')" @click="close"></button>
                </div>
            </template>
            <template v-if="panel === 'add' || panel === 'edit'">
                <template v-if="panel === 'add'">
                    <button class="qr-upload" type="button" :disabled="busy" @click="imageInput.click()"><strong>{{ t('chooseQr') }}<span aria-hidden="true">↗</span></strong><span>{{ t('chooseQrHint') }}</span></button>
                    <div class="form-divider">{{ t('manualDivider') }}</div>
                </template>
                <AccountForm :key="panel" :account="panel === 'edit' ? selected : undefined" :busy="busy" @save="saveAccount" @error="notify($event, true)" />
            </template>
            <form v-else-if="panel === 'export'" @submit.prevent="download">
                <p class="dialog-description">{{ t('exportHint', { count: otps.length }) }}</p>
                <label class="field">{{ t('fileFormat') }}<select v-model="format"><option value="json">JSON (.json)</option><option value="yaml">YAML (.yaml)</option><option value="xml">XML (.xml)</option></select></label>
                <p class="sensitive-note">{{ t('exportWarning') }}</p>
                <button class="primary-button full-width" :disabled="busy">{{ t('exportBackup') }}</button>
            </form>
            <div v-else-if="panel === 'qr'" class="qr-preview"><img :src="qrUrl" :alt="t('qrAlt')" width="280" height="280" /><h3>{{ selected.title || t('unnamed') }}</h3><p>{{ t('qrWarning') }}</p></div>
            <div v-else-if="panel === 'delete'">
                <p class="dialog-description">{{ t('deleteQuestion', { title: selected.title || t('unnamed') }) }}<br />{{ t('deleteWarning') }}</p>
                <div class="dialog-actions"><button class="secondary-button" :disabled="busy" @click="close">{{ t('cancel') }}</button><button class="danger-button" :disabled="busy" @click="remove">{{ t('deleteTitle') }}</button></div>
            </div>
            <p v-if="noticeShown && notice?.error" class="inline-error" role="alert">{{ notice.message }}</p>
        </Dialog>
    </main>
</template>
