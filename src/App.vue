<script setup>
import jsQR from 'jsqr'
import OTP from 'otp'
import { onMounted, ref } from 'vue'
import { useAppStore } from './store/appStore'
const { otps,add,del,init,clean } = useAppStore()


const canvas = document.createElement('canvas')
const ctx = canvas.getContext("2d", { willReadFrequently: true })

const addOtp = async ({name:title, secret:id }) => {
    let opt = otps.value.find(item => item.id == id)
    if(opt){
        alert(`已存在相同的配置:${opt.title}`)
    } else {
        add({id, title})
    }
}

const readFiles = async (files, source) => {
    source && console.log(`files from ${source}`)
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const imageData = await readImageFile(file)
            const qrdata = readQR(imageData)
            if (qrdata) {
                await addOtp(OTP.parse(qrdata))
            }
        }
    }
}

const readQR = ({ data, width, height }) => {
    try {
        let code = jsQR(data, width, height);
        if (code?.data?.toLowerCase()?.startsWith('otpauth://')) {
            return code.data
        }
        alert('没有解析出有效的 MFA 二维码')
    } catch (e) {
        console.error('解析二维码异常:',e)
        alert('解析二维码发生异常')
    }
}

const readImageFile = async file => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.src = url
    await image.decode()
    const { width, height } = image
    canvas.width = width
    canvas.height = height
    ctx.drawImage(image, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)
    URL.revokeObjectURL(url)
    return imageData
}

const pasteFile = async e => {
    let data = e.clipboardData
    if (data.items) {
        const files = [...data.items]
            .filter(item => item.kind == 'file')
            .map(item => item.getAsFile())
        await readFiles(files, 'paste')
    }
}

const dropFile = async e => {
    e.preventDefault()
    document.body.classList.remove('draging')
    await readFiles(e.dataTransfer.files, 'drop')
}

const fileKey = ref(Date.now())
const chooseFile = async e => {
    await readFiles(e.target.files, 'choose')
    fileKey.value = Date.now()
}

const doDel = i => {
    if(confirm('确定要删除当前配置吗？')){
        del(i)
    }
}

const doCopy = async secret => {
    const otp = new OTP({secret}).totp()
	try {
		//防止有一些特殊情况，页面input就是写入不进去，则写一份到剪切板
		await navigator.clipboard.writeText(otp)
        alert('已复制到剪切板')
	} catch (err) {
        alert(`您的code为:${otp}`)
	}
}


onMounted(async () => {
    await init()
    console.log('init datas',otps)
    const body = document.body
    body.onpaste = pasteFile
    body.ondrop = dropFile
    body.ondragover = e => e.preventDefault()
    body.ondragenter = e => body.classList.add('draging')
    body.ondragleave = e => body.classList.remove('draging')
})


</script>

<template>
    <h1>AUTO MFA
        <label class="file-btn">
            <input type="file"
                   @change="chooseFile"
                   :key="fileKey"
                   accept="image/*" />
        </label>
    </h1>
    <ul v-if="otps?.length" class="otps">
        <li v-for="(otp,i) of otps">
            <input v-model="otp.title" title="直接编辑修改"/>
            <button @click="doCopy(otp.id)">复制</button>
            <button @click="doDel(i)">删除</button>
        </li>
    </ul>
    <div v-else class="empty">
        使用下列任意方式添加 MFA 配置
        <ul>
            <li>点击右上角 <kbd>◎</kbd> 按钮</li>
            <li>复制文件或截图后使用快捷键粘贴</li>
            <li>拖放二维码图片文件至本窗口</li> 
        </ul>
    </div>

</template>

<style>

body {
    margin: 0;
    padding: 5px;
    box-sizing: border-box;
    font-size: 14px;
}

#app {
    width: 280px;
}

@keyframes drag-border-ani {
    100% {
        background-position: 10px 0, -10px 100%, 0 -10px, 100% 10px
    }
}

.draging::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    /* pointer-events: none; */
    background: linear-gradient(90deg, #1890ff 50%, transparent 0) repeat-x,
        linear-gradient(90deg, #1890ff 50%, transparent 0) repeat-x,
        linear-gradient(0deg, #1890ff 50%, transparent 0) repeat-y,
        linear-gradient(0deg, #1890ff 50%, transparent 0) repeat-y;
    background-size: 10px 2px, 10px 2px, 2px 10px, 2px 10px;
    background-position: 0 0, 0 100%, 0 0, 100% 0;
    animation: drag-border-ani .5s infinite linear;
}

h1 {
    text-align: center;
    padding: 0;
    margin: 0;
    display: block;
    line-height: 2rem;
    position: relative;
    font-size: 1.2rem;
    font-weight: normal;
    border-bottom: 1px solid #aaa;
}

ul{
    padding: 0;
    margin: 0;
    list-style: none;
}

input[type="file"] {
    display: none;
}

.file-btn {
    --side: calc(2rem - 2px);
    display: block;
    width: var(--side);
    height: var(--side);
    line-height: var(--side);
    font-size: 1.4rem;
    text-align: center;
    cursor: pointer;
    position: absolute;
    top: 1px;
    right: 1px;

    &::after {
        content: '◎';
    }

    &:hover {
        color: var(--color);
        background: var(--bgcolor);
    }
}
.empty{
    padding: 1rem;
    ul{
        opacity: .6;
    }
}
.otps{
    li{
        font-size: 14px;
        line-height: 2rem;
        display: flex;
        flex-direction: row;
        input,button{
            appearance: none;
            border:0;
            line-height: 2rem;
            height: 2rem;
            padding: 0;
            margin: 0;
            padding: 0 .5rem;

        }
        button{
            flex: 1;
            &:hover{
                background: #aaa;
                cursor: pointer;
            }
        }
        input{
            flex: auto;
            outline: none;
        }
        &:not(:last-child){
            border-bottom: 1px solid #aaa;
        }
    }
}
</style>