<script setup>
import { onMounted, ref } from 'vue'
import { useOtpStore } from './store/otpStore'
import { pasteFile, dropFile } from './scripts/mfa_decode'
import './scripts/auto_dark'


const { otps } = useOtpStore()

const init = () => {
    const body = document.body
    body.onpaste = pasteFile
    body.ondrop = dropFile
    body.ondragover = e => e.preventDefault()
    body.ondragenter = e => body.classList.add('draging')
    body.ondragleave = e => body.classList.remove('draging')
}

onMounted(init)

const test = ref('')

</script>

<template>
    <lew-flex direction="y"
              x="center"
              y="start"
              mode="between"
              style="min-height: 200px;">
        <otp-item v-if="otps.length"
                  :otps />
        <lew-empty v-else
                   type="likes"
                   title="请先添加配置" />
        <uploader />
    </lew-flex>
</template>

<style>
</style>