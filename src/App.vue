<script setup>
import { onMounted } from 'vue'
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


</script>

<template>
    <a-row style="display: flex;flex-direction: column;align-items: center;">
        <a-col flex="auto"
               style="width: 100%;">
            <otp-items :otps />
        </a-col>
        <a-col flex="1">
            <uploader />
        </a-col>
    </a-row>
</template>

<style></style>