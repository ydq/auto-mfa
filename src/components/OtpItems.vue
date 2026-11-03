<script setup vapor>
import { t } from '../i18n/index.js'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { generateCode } from '../domain/otp.js'
import CountdownBorder from './CountdownBorder.vue'
import InlineTitle from './InlineTitle.vue'

const props = defineProps({ otps: Array })
const emit = defineEmits(['rename', 'copy', 'qr', 'edit', 'delete', 'move'])
const menu = ref()
const list = ref()
const preview = ref(null)
const focusedTitle = ref('')
const query = ref('')
const appliedQuery = ref('')
const exits = ref()
let layoutVersion = 0
const ordered = computed(() => preview.value ?? props.otps)
const items = computed(() => {
    const text = appliedQuery.value.trim().toLowerCase()
    return ordered.value.filter(item => (item.title || t('unnamed')).toLowerCase().includes(text))
})
watch(query, value => animateOrder(() => { appliedQuery.value = value }, true))
watch(() => props.otps.length, count => { if (count <= 4) query.value = '' })
const now = ref(Date.now())
const codes = ref({})
const dragging = ref('')
let menuItem, timer, generation = 0, committing = false, moving = false
const remaining = item => item.period - Math.floor(now.value / 1000) % item.period
const parts = code => code ? [code.slice(0, code.length / 2), code.slice(code.length / 2)] : ['···', '···']

function prepareMenu(event, item) {
    menuItem = item
    const rect = event.currentTarget.getBoundingClientRect()
    menu.value.style.top = `${rect.bottom + 122 > innerHeight ? Math.max(8, rect.top - 122) : rect.bottom + 6}px`
    const rtl = document.documentElement.dir === 'rtl'
    menu.value.style.left = rtl ? `${Math.max(12, rect.left)}px` : 'auto'
    menu.value.style.right = rtl ? 'auto' : `${Math.max(12, innerWidth - rect.right)}px`
}
function choose(action) { menu.value.hidePopover(); emit(action, menuItem) }

watch(() => props.otps.map(item => `${item.id}:${item.algorithm}:${item.digits}:${item.period}:${Math.floor(now.value / 1000 / item.period)}`).join('|'), async () => {
    const current = ++generation
    const entries = await Promise.all(props.otps.map(async item => {
        try { return [item.id, await generateCode(item, now.value)] }
        catch { return [item.id, ''] }
    }))
    if (generation === current) codes.value = Object.fromEntries(entries)
}, { immediate: true })
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { clearInterval(timer); generation++; layoutVersion++; clearExits() })

function clearExits() {
    for (const node of exits.value?.children ?? []) node.getAnimations().forEach(animation => animation.cancel())
    exits.value?.replaceChildren()
}
async function animateOrder(change, filtering = false) {
    if (!list.value) { change(); return }
    const version = ++layoutVersion
    clearExits()
    const bounds = list.value.getBoundingClientRect()
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const previous = new Map([...list.value.children].map(node => {
        const rect = node.getBoundingClientRect()
        const clone = filtering && !reduced && node.matches('.account') && rect.bottom > bounds.top && rect.top < bounds.bottom ? node.cloneNode(true) : null
        if (clone) {
            const stroke = clone.querySelector('.border-progress')
            const original = getComputedStyle(node.querySelector('.border-progress'))
            Object.assign(stroke.style, { strokeDashoffset: original.strokeDashoffset, opacity: original.opacity })
        }
        return [node, { rect, clone, opacity: getComputedStyle(node).opacity }]
    }))
    change()
    await nextTick()
    if (!list.value || version !== layoutVersion || reduced) return
    for (const node of list.value.children) {
        const before = previous.get(node)
        node.getAnimations().forEach(animation => animation.cancel())
        const after = node.getBoundingClientRect()
        if (!before) {
            if (filtering) node.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' })
        } else if (Math.abs(before.rect.top - after.top) >= 1 || (filtering && Number(before.opacity) < 1)) {
            node.animate([{ transform: `translateY(${before.rect.top - after.top}px)`, ...(filtering ? { opacity: before.opacity } : {}) }, { transform: 'none', ...(filtering ? { opacity: 1 } : {}) }],
                { duration: 220, easing: 'cubic-bezier(.2,.75,.25,1)' })
        }
    }
    if (!filtering) return
    Object.assign(exits.value.style, { top: `${bounds.top}px`, left: `${bounds.left}px`, width: `${bounds.width}px`, height: `${bounds.height}px` })
    for (const [node, { rect, clone, opacity }] of previous) {
        if (!clone || list.value.contains(node)) continue
        Object.assign(clone.style, { position: 'absolute', top: `${rect.top - bounds.top}px`, left: `${rect.left - bounds.left}px`, width: `${rect.width}px`, margin: '0' })
        exits.value.append(clone)
        const animation = clone.animate([{ opacity: Number(opacity), transform: 'none' }, { opacity: 0, transform: 'translateY(-5px)' }], { duration: 160, easing: 'ease-out', fill: 'forwards' })
        animation.finished.then(() => clone.remove(), () => clone.remove())
    }
}

function start(event, item) {
    if (committing) { event.preventDefault(); return }
    dragging.value = item.id
    preview.value = [...props.otps]
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-auto-mfa', 'reorder')
    const row = event.currentTarget.closest('.account')
    const bounds = row.getBoundingClientRect()
    event.dataTransfer.setDragImage(row, event.clientX - bounds.left, event.clientY - bounds.top)
}
async function previewMove(event, item, force = false) {
    if (!dragging.value || dragging.value === item.id || moving) return
    const from = ordered.value.findIndex(account => account.id === dragging.value)
    const to = ordered.value.findIndex(account => account.id === item.id)
    if (from < 0 || to < 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!force && ((from < to && event.clientY < bounds.top + bounds.height / 2) || (from > to && event.clientY > bounds.top + bounds.height / 2))) return
    moving = true
    await animateOrder(() => {
        const order = [...ordered.value]
        order.splice(to, 0, order.splice(from, 1)[0])
        preview.value = order
    })
    moving = false
}
function restore() { committing = false; return animateOrder(() => { preview.value = null }) }
function finish() {
    dragging.value = ''
    if (!committing) restore()
}
async function drop(event, item) {
    if (!dragging.value) return
    event.preventDefault()
    event.stopPropagation()
    const id = dragging.value
    committing = true
    await previewMove(event, item, true)
    const index = ordered.value.findIndex(account => account.id === id)
    const target = props.otps[index]
    if (target && target.id !== id) {
        emit('move', id, target.id, restore)
    } else { restore() }
    finish()
}
async function reorderKey(event, index) {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key) || committing) return
    event.preventDefault()
    const destination = index + (event.key === 'ArrowUp' ? -1 : 1)
    const target = items.value[destination]
    if (!target) return
    const id = items.value[index].id
    committing = true
    const handle = event.currentTarget
    await animateOrder(() => {
        const order = [...ordered.value]
        const from = order.findIndex(account => account.id === id)
        const to = order.findIndex(account => account.id === target.id)
        order.splice(to, 0, order.splice(from, 1)[0])
        preview.value = order
    })
    handle.focus({ preventScroll: true })
    emit('move', id, target.id, restore)
}
</script>

<template>
    <label v-if="otps.length > 4" class="search-field">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input v-model="query" dir="auto" type="search" :aria-label="t('search')" :placeholder="t('search')" autocomplete="off" maxlength="200" />
    </label>
    <ul ref="list" class="accounts" :aria-label="t('accountList')">
        <li v-for="(item, index) in items" :key="item.id" class="account" :class="{ dragging: dragging === item.id }"
            @dragover="event => { if (dragging) { event.preventDefault(); previewMove(event, item) } }" @drop="drop($event, item)">
            <CountdownBorder :period="item.period" :now="now" />
            <div class="account-inner">
                <div class="title-group" :class="{ 'title-editing': focusedTitle === item.id }">
                <button type="button" class="drag-handle" draggable="true" :tabindex="focusedTitle === item.id ? -1 : 0" :aria-hidden="focusedTitle === item.id" :aria-label="t('sortLabel')" :title="t('sortHint')"
                    @dragstart="start($event, item)" @dragend="finish" @keydown="reorderKey($event, index)"><span aria-hidden="true">⠿</span></button>
                <InlineTitle :title="item.title" :label="t('rowName', { index: index + 1 })" @focus-change="focused => focusedTitle = focused ? item.id : ''" @save="(title, settled) => emit('rename', item.id, title, settled)" />
                </div>
                <button class="code" dir="ltr" type="button" :disabled="!codes[item.id]" :aria-label="t('copyCode', { title: item.title || t('unnamed') })" :title="t('copyHint')" draggable="true"
                    @click="emit('copy', item)" @dragstart.stop="$event.dataTransfer.setData('text/plain', codes[item.id] || '')">
                    <span class="code-digits"><span>{{ parts(codes[item.id])[0] }}</span><span>{{ parts(codes[item.id])[1] }}</span></span><small>{{ remaining(item) }}s</small>
                </button>
                <button class="icon-button account-more" type="button" :aria-label="t('accountOptions')" :title="t('accountOptions')" popovertarget="account-menu" @click="prepareMenu($event, item)"><span class="ellipsis" aria-hidden="true"><i></i><i></i><i></i></span></button>
            </div>
        </li>
        <li v-if="!items.length" class="search-empty" role="status">{{ t('noMatches') }}</li>
    </ul>
    <div ref="exits" class="filter-exits" aria-hidden="true" inert></div>
    <div ref="menu" id="account-menu" class="floating-menu account-menu" popover="auto" :aria-label="t('accountOptions')">
        <button class="text-button" type="button" @click="choose('qr')">{{ t('viewQr') }}</button>
        <button class="text-button" type="button" @click="choose('edit')">{{ t('editAccount') }}</button>
        <button class="text-button danger" type="button" @click="choose('delete')">{{ t('deleteTitle') }}</button>
    </div>
</template>
