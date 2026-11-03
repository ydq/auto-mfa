import { t } from '../i18n/index.js'
// Shared by the popup and service worker. Web Crypto keeps OTP generation dependency-free.
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function normalizeSecret(value) {
    if (typeof value !== 'string') throw new Error(t('secretRequired'))
    const secret = value.replace(/\s/g, '').toUpperCase().replace(/=+$/, '')
    if (!/^[A-Z2-7]{2,1024}$/.test(secret) || ![0, 2, 4, 5, 7].includes(secret.length % 8)) {
        throw new Error(t('invalidSecret'))
    }
    const remainder = secret.length * 5 % 8
    if (remainder && (alphabet.indexOf(secret.at(-1)) & ((1 << remainder) - 1))) {
        throw new Error(t('invalidSecretEnd'))
    }
    return secret
}

export function requireTitle(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(t('titleRequired'))
    return value.trim()
}

export function normalizeAccount(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('invalidAccount'))
    const id = normalizeSecret(value.id ?? value.secret)
    const title = value.title ?? value.name ?? ''
    if (typeof title !== 'string' || title.length > 200 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(title)) {
        throw new Error(t('invalidTitle'))
    }
    const algorithm = String(value.algorithm ?? 'SHA1').toUpperCase().replaceAll('-', '')
    const digits = Number(value.digits ?? 6)
    const period = Number(value.period ?? 30)
    if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) throw new Error(t('invalidAlgorithm'))
    if (![6, 8].includes(digits)) throw new Error(t('invalidDigits'))
    if (!Number.isInteger(period) || period < 1 || period > 3600) throw new Error(t('invalidPeriod'))
    return { id, title: title.trim() || t('unnamed'), algorithm, digits, period }
}

export function parseOtpUri(text) {
    let uri
    try { uri = new URL(text.trim()) } catch { throw new Error(t('invalidUri')) }
    if (uri.protocol !== 'otpauth:' || uri.hostname !== 'totp') throw new Error(t('totpOnly'))
    let title
    try { title = decodeURIComponent(uri.pathname.slice(1)) } catch { throw new Error(t('invalidNameEncoding')) }
    const issuer = uri.searchParams.get('issuer')
    if (issuer && !title.startsWith(`${issuer}:`)) title = `${issuer}: ${title}`
    return normalizeAccount({
        secret: uri.searchParams.get('secret'), title,
        algorithm: uri.searchParams.get('algorithm') ?? undefined,
        digits: uri.searchParams.get('digits') ?? undefined,
        period: uri.searchParams.get('period') ?? undefined,
    })
}

export function toOtpUri(value) {
    const account = normalizeAccount(value)
    const params = new URLSearchParams({ secret: account.id, algorithm: account.algorithm, digits: account.digits, period: account.period })
    return `otpauth://totp/${encodeURIComponent(account.title || 'MFA')}?${params}`
}

function decodeSecret(secret) {
    let bits = 0, buffer = 0
    const bytes = []
    for (const char of secret) {
        buffer = (buffer << 5) | alphabet.indexOf(char)
        bits += 5
        if (bits >= 8) {
            bits -= 8
            bytes.push((buffer >>> bits) & 255)
        }
    }
    return new Uint8Array(bytes)
}

export async function generateCode(value, now = Date.now()) {
    const account = normalizeAccount(value)
    const key = await crypto.subtle.importKey('raw', decodeSecret(account.id),
        { name: 'HMAC', hash: account.algorithm.replace('SHA', 'SHA-') }, false, ['sign'])
    const counter = new ArrayBuffer(8)
    new DataView(counter).setBigUint64(0, BigInt(Math.floor(now / 1000 / account.period)))
    const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter))
    const offset = digest.at(-1) & 15
    const number = new DataView(digest.buffer).getUint32(offset) & 0x7fffffff
    return String(number % (10 ** account.digits)).padStart(account.digits, '0')
}
