<script setup>
import { ref } from 'vue'
import { chooseFile } from '../scripts/mfa_decode'

const fileEl = ref()

</script>
<template>
    <a-tooltip mini
               position="top"
               content="可以直接拖放文件或复制粘贴二维码文件或截图到本窗口来添加配置"
               :content-style="{ maxWidth: '260px' }">
        <a-button type="dashed"
                  size="mini"
                  shape="round"
                  @click="fileEl.click()">
            <template #icon><icon-robot-add /></template>
            添加配置
        </a-button>
    </a-tooltip>
    <input type="file"
           multiple
           @change="chooseFile"
           accept="image/*"
           ref="fileEl"
           style="display: none;" />
</template>