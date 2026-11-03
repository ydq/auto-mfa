import { t } from '../i18n/index.js'
import { parseOtpUri } from '../domain/otp.js'

// No decoder work or QR code library in the popup's initial bundle.
export async function readQrFiles(files) {
    const { default: jsQR } = await import('jsqr')
    const accounts = []
    for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error(t('qrImageRequired'))
        const image = new Image()
        const url = URL.createObjectURL(file)
        try {
            image.src = url
            try { await image.decode() } catch { throw new Error(t('imageReadFailed')) }
            if (!image.width || !image.height || image.width * image.height > 20_000_000) throw new Error(t('imageTooLarge'))
            const canvas = document.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            ctx.drawImage(image, 0, 0)
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const result = jsQR(pixels.data, pixels.width, pixels.height)
            if (!result) throw new Error(t('qrNotFound'))
            accounts.push(parseOtpUri(result.data))
        } finally { URL.revokeObjectURL(url) }
    }
    return accounts
}
