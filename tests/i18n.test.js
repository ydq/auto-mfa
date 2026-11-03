import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { locales, resolveLocale, systemLocale, initializeI18n, currentLocale, t } from '../src/i18n/index.js'

const catalogs = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(new URL(`../src/i18n/${locale}.json`, import.meta.url)))]))
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

test('all supported catalogs have complete, matching placeholders and valid Chrome metadata', () => {
    const keys = Object.keys(catalogs.en).sort()
    for (const [locale, catalog] of Object.entries(catalogs)) {
        assert.deepEqual(Object.keys(catalog).sort(), keys, locale)
        for (const key of keys) {
            assert.ok(catalog[key].message.trim(), `${locale}:${key}`)
            assert.deepEqual(placeholders(catalog[key].message), placeholders(catalogs.en[key].message), `${locale}:${key}`)
        }
        assert.ok(catalog.description.message.length <= 132, `${locale}: description too long`)
    }
})

test('browser locale resolves regional variants and falls back to English', () => {
    for (const [tag, expected] of [['zh_CN','zh-CN'],['zh-SG','zh-CN'],['zh-TW','zh-TW'],['zh-HK','zh-TW'],['zh-Hant','zh-TW'],['zh-Hant-HK','zh-TW'],['zh-Hans-TW','zh-CN'],['ko-KR','ko'],['ja-JP','ja'],['en-GB','en'],['de-AT','de'],['ru-RU','ru'],['th-TH','th'],['ar-EG','ar'],['fr-CA','fr'],['es-419','es'],['pt-PT','pt-BR'],['pt-BR','pt-BR'],['it-IT','en'],['','en']]) assert.equal(resolveLocale(tag), expected, tag)
})

test('native extension catalogs localize messages without translating user values', () => {
    const oldChrome = globalThis.chrome
    try {
        for (const [locale, catalog] of Object.entries(catalogs)) {
            globalThis.chrome = { i18n: { getUILanguage: () => locale, getMessage: key => catalog[key]?.message ?? '' } }
            assert.equal(systemLocale(), locale)
            assert.equal(t('add'), catalog.add.message)
            const title = '工作 / العمل {code} <script>'
            assert.ok(t('deleteQuestion', { title }).includes(title))
            assert.ok(!t('exportHint', { count: 4 }).includes('{count}'))
            assert.equal(t('unknown_key'), 'unknown_key')
        }
    } finally { globalThis.chrome = oldChrome }
})

test('web preview loads only its system catalog and falls back safely on load failure', async () => {
    const oldChrome = globalThis.chrome, oldFetch = globalThis.fetch, oldLocation = globalThis.location
    try {
        let calls = []
        globalThis.location = { href: 'http://localhost:4173/' }
        globalThis.chrome = { i18n: { getUILanguage: () => 'ar-EG' } }
        globalThis.fetch = async url => { calls.push(String(url)); return { ok: true, json: async () => catalogs.ar } }
        await initializeI18n()
        assert.equal(currentLocale(), 'ar')
        assert.equal(t('add'), catalogs.ar.add.message)
        assert.deepEqual(calls, ['http://localhost:4173/_locales/ar/messages.json'])
        globalThis.fetch = async () => ({ ok: false })
        await initializeI18n()
        assert.equal(currentLocale(), 'en')
        assert.equal(t('add'), catalogs.en.add.message)
        globalThis.chrome.i18n.getUILanguage = () => 'en'
        await initializeI18n()
        assert.equal(t('add'), 'Add')
    } finally { globalThis.chrome = oldChrome; globalThis.fetch = oldFetch; globalThis.location = oldLocation }
})
