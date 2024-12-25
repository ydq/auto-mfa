<script setup>
import OTP from 'otp'
import { LewDialog, LewMessage } from 'lew-ui'
import { useOtpStore } from '../store/otpStore'

const { del } = useOtpStore()
const { otps = [] } = defineProps(['otps'])

const doDel = i => {
    LewDialog.error({
        content: '确定要删除吗？',
        closeOnClickOverlay: true,
        layout: 'mini',
        ok() {
            del(i)
        }
    })
}

const doCopy = async secret => {
    const otp = new OTP({ secret }).totp()
    try {
        await navigator.clipboard.writeText(otp)
        LewMessage.info({ content: '已复制到剪切板' })
    } catch (err) {
        LewMessage.info({ content: `code:${otp}` })
    }
}

</script>
<template>
    <lew-flex v-for="(otp, i) of otps">
        <lew-input v-model="otp.title"
                   size="small"
                   placeholder="请输入MFA名称标识" />
        <lew-button @click="doCopy(otp.id)"
                    text="复制"
                    type="light"
                    size="small" />
        <lew-button @click="doDel(i)"
                    text="删除"
                    type="light"
                    color="red"
                    size="small" />
    </lew-flex>

</template>