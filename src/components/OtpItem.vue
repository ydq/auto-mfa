<script setup>
import OTP from 'otp'
import { LewDialog, LewMessage } from 'lew-ui'
import { useOtpStore } from '../store/otpStore'
import { ClipboardCheck, ClipboardX } from 'lucide-vue-next'
import { h } from 'vue'

const { del } = useOtpStore()
const { otps = [] } = defineProps(['otps'])

const options = [
    { label: '复制Code', value: 'copy', renderIcon: () => h(ClipboardCheck, { size: 14 }), },
    { label: '删除配置', value: 'del', renderIcon: () => h(ClipboardX, { size: 14 }), },
]

const operate = async (action, otp, i) => {
    if (action == 'copy') {
        const code = new OTP({ secret: otp.id }).totp()
        try {
            await navigator.clipboard.writeText(code)
            LewMessage.info({ content: '已复制到剪切板', duration: 1000 })
        } catch (err) {
            LewMessage.info({ content: `code:${code}`, duration: 2000 })
        }
    } else if (action == 'del') {
        LewDialog.error({
            content: '确定要删除吗？',
            closeOnClickOverlay: true,
            layout: 'mini',
            ok() {
                del(i)
            }
        })
    }
}

</script>
<template>
    <transition-group>
        <lew-flex v-for="(otp, i) of otps"
                  :key="otp.id">
            <lew-input v-model="otp.title"
                       size="small"
                       placeholder="请输入MFA名称标识" />
            <lew-dropdown :options
                          placement="left-start"
                          @change="e => operate(e.value, otp, i)">
                <lew-button text="操作"
                            size="small"
                            type="light" />
            </lew-dropdown>
        </lew-flex>
    </transition-group>

</template>