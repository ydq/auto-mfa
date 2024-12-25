<script setup>
import { ref } from 'vue';
import { chooseFile } from '../scripts/mfa_decode'

const fileEl = ref()

</script>
<template>
    <lew-button size="mini"
                round
                dashed
                text="+ 添加配置"
                @click="fileEl.click()"
                type="ghost" 
                v-tooltip="{
                    content:'你还可以直接拖放文件或复制粘贴二维码图片文件或截图到本窗口来添加配置',
                    placement:'top'
                }"/>
    <input type="file"
           multiple
           @change="chooseFile"
           accept="image/*"
           ref="fileEl"
           style="display: none;" />
</template>