import en from './en.json' with { type: 'json' }

export const locales = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'ru', 'de', 'th', 'ar', 'fr', 'es', 'pt-BR']

export function resolveLocale(language = '') {
    const tag = String(language).toLowerCase().replaceAll('_', '-')
    if (/^zh(?:-|$)/.test(tag)) return !tag.includes('-hans') && (tag.includes('-hant') || /(?:^|-)(tw|hk|mo)(?:-|$)/.test(tag)) ? 'zh-TW' : 'zh-CN'
    if (/^pt(?:-|$)/.test(tag)) return 'pt-BR'
    return locales.find(locale => locale === tag.split('-')[0]) ?? 'en'
}

export function systemLocale() {
    return resolveLocale(globalThis.chrome?.i18n?.getUILanguage?.() ?? globalThis.navigator?.language)
}

let messages = en
let language = systemLocale()
export const currentLocale = () => language

// Chrome loads the matching catalog natively; the web preview fetches just one language.
export async function initializeI18n() {
    language = systemLocale()
    messages = en
    if (globalThis.chrome?.i18n?.getMessage || language === 'en') return
    try {
        const response = await fetch(new URL(`_locales/${language.replaceAll('-', '_')}/messages.json`, location.href))
        if (!response.ok) throw new Error('Missing locale')
        messages = await response.json()
    } catch { messages = en; language = 'en' }
}

export function t(key, values = {}) {
    const message = globalThis.chrome?.i18n?.getMessage?.(key) || messages[key]?.message || en[key]?.message || key
    return message.replace(/\{(\w+)\}/g, (placeholder, name) => String(values[name] ?? placeholder))
}
