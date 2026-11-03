import { t } from '../i18n/index.js'
import { normalizeAccount } from './otp.js'

export const CONFIG_VERSION = 1
export const CONFIG_FIELDS = ['secret', 'title', 'algorithm', 'digits', 'period']

export function normalizeList(value) {
    const list = Array.isArray(value) ? value : value?.list
    if (!Array.isArray(list)) throw new Error(t('listRequired'))
    if (value?.version !== undefined && value.version !== CONFIG_VERSION) throw new Error(t('invalidVersion'))
    return list.map((account, index) => {
        try { return normalizeAccount(account) }
        catch (error) { throw new Error(t('accountError', { index: index + 1, message: error.message })) }
    })
}

const escapeXml = value => String(value).replace(/[<>&"'\r]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;', '\r': '&#13;' })[char])

export function toConfig(list) {
    return { version: CONFIG_VERSION, list: normalizeList(list).map(({ id, ...rest }) => ({ secret: id, ...rest })) }
}

export function exportConfig(list, format) {
    const config = toConfig(list)
    const accounts = config.list
    switch (format) {
        case 'json': return JSON.stringify(config, null, 2)
        case 'yaml': return `version: ${CONFIG_VERSION}\nlist:${accounts.length ? '\n' + accounts.map(account => Object.entries(account).map(([key, value], index) => `  ${index ? ' ' : '-'} ${key}: ${JSON.stringify(value)}`).join('\n')).join('\n') : ' []'}\n`
        case 'xml': return `<?xml version="1.0" encoding="UTF-8"?>\n<mfa version="${CONFIG_VERSION}">\n${accounts.map(account => `  <account>\n${Object.entries(account).map(([key, value]) => `    <${key}>${escapeXml(value)}</${key}>`).join('\n')}\n  </account>`).join('\n')}\n</mfa>\n`
        default: throw new Error(t('invalidExport'))
    }
}

// A deliberately small reader for this backup schema, not a general-purpose YAML engine.
// Quoted text uses YAML's JSON-compatible double-quoted strings; no tags, aliases or complex objects.
function readYaml(source) {
    let list, version, account
    const scalar = text => {
        if (text.startsWith('"')) return JSON.parse(text)
        if (/^-?\d+$/.test(text)) return Number(text)
        if (/^[^\s\[\]{}&*!|>'"%@`#][^\r\n]*$/.test(text)) return text
        throw new Error(t('yamlValue'))
    }
    for (const raw of source.split(/\r?\n/)) {
        if (!raw.trim() || /^\s*#/.test(raw) || ['---', '...'].includes(raw.trim())) continue
        let match
        if ((match = raw.match(/^version: (.+)$/))) {
            if (version !== undefined) throw new Error(t('yamlVersion'))
            version = scalar(match[1])
        } else if (/^list:(?: \[\])?$/.test(raw)) {
            if (list) throw new Error(t('yamlList'))
            list = []
        } else if ((match = raw.match(/^  (-| ) ([a-z]+): (.*)$/))) {
            if (!list) throw new Error(t('yamlMissingList'))
            if (match[1] === '-') { account = {}; list.push(account) }
            const key = match[2]
            if (!account || !CONFIG_FIELDS.includes(key) || Object.hasOwn(account, key)) throw new Error(t('yamlFields'))
            account[key] = scalar(match[3])
        } else { throw new Error(t('yamlStructure')) }
    }
    return { version, list }
}

export function importConfig(text) {
    const source = text.replace(/^\uFEFF/, '').trim()
    try {
        if (source.startsWith('<')) {
            if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(t('xmlEntities'))
            const doc = new DOMParser().parseFromString(source, 'application/xml')
            const root = doc.documentElement
            if (doc.querySelector('parsererror') || root.tagName !== 'mfa' || root.getAttribute('version') !== String(CONFIG_VERSION)) throw new Error(t('xmlFormat'))
            const list = [...root.children].map(node => {
                if (node.tagName !== 'account') throw new Error(t('xmlNode'))
                const account = {}
                for (const child of node.children) {
                    if (!CONFIG_FIELDS.includes(child.tagName) || Object.hasOwn(account, child.tagName) || child.children.length) throw new Error(t('xmlFields'))
                    account[child.tagName] = child.textContent
                }
                return account
            })
            return normalizeList(list)
        }
        return normalizeList(/^[\[{]/.test(source) ? JSON.parse(source) : readYaml(source))
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error(t('invalidBackup'))
        throw error
    }
}
