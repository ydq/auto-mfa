<script setup>
import OTP from 'otp'
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
    const code = new OTP({ secret: otp.id }).totp()
    try {
        await navigator.clipboard.writeText(code)
        info({ content: `code:${code} 已复制到剪切板` })
    } catch (err) {
        info({ content: `code:${code}` })
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
                <a-tooltip mini
                           content="备注名称直接编辑自动保存">
                    <a-input v-model="item.title"
                             placeholder="请输入备注名称"
                             style="flex: 1;width: 100%;" />
                </a-tooltip>
                <template #actions>
                    <a-button-group>
                        <a-tooltip mini
                                   content="复制Code">
                            <a-button @click="doCopy(index, item)">
                                <template #icon><icon-copy /></template>
                            </a-button></a-tooltip>
                        <a-tooltip mini
                                   content="导出二维码">
                            <a-button @click="makeQrcode(index, item)">
                                <template #icon><icon-qrcode /></template>
                            </a-button></a-tooltip>
                        <a-tooltip mini
                                   content="删除配置">
                            <a-button status="danger"
                                      @click="doDel(index, item)">
                                <template #icon><icon-delete /></template>
                            </a-button></a-tooltip>
                    </a-button-group>
                </template>
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