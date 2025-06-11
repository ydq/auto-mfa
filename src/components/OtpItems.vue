<script setup>
import OTP from 'otp'
import { onMounted, ref } from 'vue'
import { useOtpStore } from '../store/otpStore'
import { info, confirm } from '../scripts/modal'
import { h, reactive } from 'vue'
import QRCode from 'qrcode'

const { otps = [] } = defineProps(['otps'])
const { del } = useOtpStore()


const qrcode = reactive({
    visible: false
})


const doCopy = async (i, otp) => {
    console.log(new OTP({ secret: otp.id }))
    const code = new OTP({ secret: otp.id }).totp()
    try {
        await navigator.clipboard.writeText(code)
        info({ content: `验证码 ${code} 已复制到剪切板` })
    } catch (err) {
        info({ content: `验证码 ${code}` })
    }
}


const doDel = (i, otp) => {
    confirm({
        content: '确定删除该配置吗？删除后不可恢复，请提前备份！',
        onOk() {
            del(i)
        },
    });
}

const makeQrcode = async (i, { title, id }) => {
    qrcode.visible = true
    qrcode.url = await QRCode.toDataURL(`otpauth://totp/${title}?secret=${id}`)
}

const calcCode = ({ id: secret }) => new OTP({ secret }).totp()

const calcProgress = () => Date.now() / 1e3 % 30 / 30

const percent = ref(calcProgress())

setInterval(() => {
    percent.value = calcProgress()
}, 1e3)


</script>
<template>
    <a-list size="small"
            :bordered="false"
            :split="false"
            :data="otps"
            style="height: 180px;"
            max-height="180px">
        <template #empty>
            <a-empty description="请先添加配置" />
        </template>
        <template #item="{ index, item }">
            <a-list-item style="width: 100%;padding:5px">
                <a-input-group>
                    <a-input v-model="item.title"
                             placeholder="请输入备注名称"
                             style="flex: 1;width: 100%;">
                    </a-input>
                    <a-button-group>
                        <a-button @click="doCopy(index, item)"
                                  draggable="true"
                                  @dragstart="e => e.dataTransfer.setData('Text', e.target.innerText)"
                                  style="font-family: monospace;padding:0 8px">
                            {{ calcCode(item) }}
                            <template #icon>
                                <a-progress size="mini"
                                            :percent
                                            :width="16"
                                            style="cursor: move;" />
                            </template>
                        </a-button>
                        <a-button @click="makeQrcode(index, item)">
                            <template #icon><icon-qrcode /></template>
                        </a-button>
                        <a-button status="danger"
                                  @click="doDel(index, item)">
                            <template #icon><icon-delete /></template>
                        </a-button>
                    </a-button-group>
                </a-input-group>
            </a-list-item>
        </template>
    </a-list>

    <a-drawer title="MFA二维码"
              :visible="qrcode.visible"
              :footer="false"
              width="182px"
              placement="left"
              @cancel="qrcode.visible = false">
        <img width="150"
             :src="qrcode.url" />
    </a-drawer>
</template>