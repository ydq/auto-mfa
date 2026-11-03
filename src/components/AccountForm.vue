<script setup vapor>
import { t } from '../i18n/index.js'
import { reactive, ref, computed } from 'vue'
import { normalizeAccount, parseOtpUri, requireTitle } from '../domain/otp.js'
import Dialog from './Dialog.vue'

const props = defineProps({ account: Object, busy: Boolean })
const emit = defineEmits(['save', 'error'])
const form = reactive({
    title: props.account?.title ?? '',
    secret: props.account?.id ?? '',
    algorithm: props.account?.algorithm ?? 'SHA1',
    digits: props.account?.digits ?? 6,
    period: props.account?.period ?? 30,
})
const secretVisible = ref(false)
const pending = ref(null)
const settingLabels = { id: 'secret', algorithm: 'algorithmSetting', digits: 'digitsSetting', period: 'periodSetting' }
const changedSettings = computed(() => pending.value ? Object.entries(settingLabels).filter(([key]) => pending.value[key] !== normalizeAccount(props.account)[key]).map(([, key]) => t(key)) : [])
function confirmSave() {
    const account = pending.value
    pending.value = null
    emit('save', account)
}
const advanced = form.algorithm !== 'SHA1' || form.digits !== 6 || form.period !== 30
function save() {
    try {
        const account = /^otpauth:/i.test(form.secret.trim()) ? parseOtpUri(form.secret) : normalizeAccount({ ...form, id: form.secret })
        account.title = requireTitle(form.title.trim() || (/^otpauth:/i.test(form.secret.trim()) ? account.title : ''))
        if (props.account && Object.keys(settingLabels).some(key => account[key] !== normalizeAccount(props.account)[key])) pending.value = account
        else emit('save', account)
    } catch (error) { emit('error', error.message) }
}
</script>

<template>
    <form @submit.prevent="save">
        <fieldset class="account-fields" :disabled="busy">
            <label class="field">{{ t('name') }}<input v-model="form.title" dir="auto" :required="!/^otpauth:/i.test(form.secret.trim())" maxlength="200" :placeholder="t('namePlaceholder')" autocomplete="off" /></label>
            <div class="field"><label for="account-secret">{{ t('secretOrUri') }}</label><div class="secret-control">
                <input id="account-secret" dir="ltr" v-model="form.secret" required :type="secretVisible ? 'text' : 'password'" :placeholder="t('secretPlaceholder')" autocomplete="off" spellcheck="false" />
                <button class="icon-button eye-button" type="button" :aria-label="secretVisible ? t('hideSecret') : t('showSecret')" :aria-pressed="secretVisible" :title="secretVisible ? t('hideSecret') : t('showSecret')" @click="secretVisible = !secretVisible">
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" /><circle cx="10" cy="10" r="2.5" /><path v-if="secretVisible" d="m3 3 14 14" /></svg>
                </button>
            </div></div>
            <details class="advanced" :open="advanced"><summary>{{ t('advanced') }}</summary><div class="advanced-fields">
                <label class="field">{{ t('algorithm') }}<select v-model="form.algorithm"><option>SHA1</option><option>SHA256</option><option>SHA512</option></select></label>
                <label class="field">{{ t('digits') }}<select v-model.number="form.digits"><option :value="6">{{ t('digitsOption', { count: 6 }) }}</option><option :value="8">{{ t('digitsOption', { count: 8 }) }}</option></select></label>
                <label class="field">{{ t('period') }}<input v-model.number="form.period" type="number" min="1" max="3600" required /></label>
            </div></details>
            <button class="primary-button full-width" :disabled="busy">{{ account ? t('saveChanges') : t('saveAccount') }}</button>
        </fieldset>
    </form>
    <Dialog v-if="pending" :title="t('confirmEdit')" mode="confirm-edit" @close="pending = null">
        <p class="dialog-description">{{ t('confirmEditHint', { fields: changedSettings.join(t('listSeparator')) }) }}</p>
        <div class="dialog-actions"><button class="secondary-button" type="button" @click="pending = null">{{ t('backToEdit') }}</button><button class="primary-button" type="button" @click="confirmSave">{{ t('confirmSave') }}</button></div>
    </Dialog>
</template>
