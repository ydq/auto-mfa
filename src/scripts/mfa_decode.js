import jsQR from "jsqr"
import OTP from 'otp'
import { info } from '../scripts/modal'
import { useOtpStore } from '../store/otpStore'

const { otps, add } = useOtpStore()

const canvas = document.createElement('canvas')
const ctx = canvas.getContext("2d", { willReadFrequently: true })

/**
 * 根据图片文件解析二维码
 * @param {ImageData} param0 
 */
const readQR = ({ data, width, height }) => {
    try {
        let code = jsQR(data, width, height);
        if (code?.data?.toLowerCase()?.startsWith('otpauth://')) {
            return code.data
        }
        info({ content: '未解析到有效MFA' })
    } catch (e) {
        console.error('解析二维码异常:', e)
        info({ content: '解析二维码失败' })
    }
}

/**
 * 读取图片文件数据
 * @param {File} file 
 */
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

/**
 * 读取解析图片文件
 * @param {Array.<File>} files 从各个方法统一后的文件列表
 * @param {string} source 来源，仅仅只是为了日志记录一下，没啥用
 */
const readFiles = async (files, source) => {
    source && console.log(`files from ${source}`)
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const imageData = await readImageFile(file)
            const qrdata = readQR(imageData)
            if (qrdata) {
                const { name: title, secret: id } = OTP.parse(qrdata)
                let opt = otps.value.find(item => item.id == id)
                if (opt) {
                    // alert(`已存在相同的配置:${opt.title}`)
                    info({ content: `已存在相同配置` })
                } else {
                    add({ id, title })
                }
            }
        }
    }
}


/**
 * 粘贴文件
 * @param {ClipboardEvent} e 剪切板事件
 */
const pasteFile = async e => {
    let data = e.clipboardData
    if (data.items) {
        const files = [...data.items]
            .filter(item => item.kind == 'file')
            .map(item => item.getAsFile())
        await readFiles(files, 'paste')
    }
}

/**
 * 文件拖放
 * @param {DragEvent} e 文件拖放事件
 */
const dropFile = async e => {
    e.preventDefault()
    document.body.classList.remove('draging')
    await readFiles(e.dataTransfer.files, 'drop')
}

/**
 * 文件选择
 * @param {Event} e file[type=input]的 change 事件
 */
const chooseFile = async e => {
    await readFiles(e.target.files, 'choose')
}

export { pasteFile, dropFile, chooseFile }