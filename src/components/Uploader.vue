<script setup>
import { ref } from 'vue';
import { chooseFile } from '../scripts/mfa_decode'
import { ClipboardPlus } from 'lucide-vue-next'

const fileEl = ref()

</script>
<template>
    <lew-button size="mini"
                    round
                    dashed
                    @click="fileEl.click()"
                    type="ghost"
                    v-tooltip="{
                        content: '可以直接拖放文件或复制粘贴二维码文件或截图到本窗口来添加配置',
                        placement: 'top'
                    }">
            <clipboard-plus :size="16" />添加配置
        </lew-button>
        <input type="file"
               multiple
               @change="chooseFile"
               accept="image/*"
               ref="fileEl"
               style="display: none;" />
</template>