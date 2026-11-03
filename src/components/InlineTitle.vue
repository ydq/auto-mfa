<script setup vapor>
import { t } from '../i18n/index.js'
import { ref, watch } from 'vue'
const props = defineProps({ title: String, label: String })
const emit = defineEmits(['save', 'focus-change'])
const input = ref()
const draft = ref(props.title)
const editing = ref(false)
const saving = ref(false)
watch(() => props.title, title => { if (!editing.value && !saving.value) draft.value = title })
function begin() {
    emit('focus-change', true)
    if (!saving.value && !editing.value) { draft.value = props.title; editing.value = true }
}
function reset() {
    if (saving.value) return
    draft.value = props.title
    editing.value = false
}
function save() {
    if (saving.value || !editing.value) return
    const title = draft.value.trim()
    if (!title) return
    if (title === props.title) { reset(); input.value?.blur(); return }
    saving.value = true
    emit('save', title, () => {
        saving.value = false
        reset()
        input.value?.blur()
    })
}
function leave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) { reset(); emit('focus-change', false) }
}
function keydown(event) {
    if (event.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') { event.preventDefault(); reset(); input.value?.blur() }
    else if (event.key === 'Enter' && event.target === input.value) { event.preventDefault(); save() }
}
</script>

<template>
    <div class="inline-title" @focusout="leave" @keydown="keydown">
        <input ref="input" dir="auto" v-model="draft" class="account-title" :readonly="saving" :placeholder="t('enterName')" required :aria-invalid="editing && !draft.trim()" :aria-label="label" maxlength="200" autocomplete="off" @focus="begin" />
        <template v-if="editing && !saving && draft !== title">
            <button class="inline-action" type="button" :disabled="!draft.trim()" :aria-label="t('confirmName')" :title="t('confirmNameHint')" @pointerdown.prevent @click="save"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg></button>
            <button class="inline-action" type="button" :aria-label="t('undoName')" :title="t('undoNameHint')" @pointerdown.prevent @click="reset(); input.blur()"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 2-3 3 3 3M2.5 5h7a4 4 0 0 1 0 8H6.5" /></svg></button>
        </template>
    </div>
</template>
