import { t } from '../src/i18n/index.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateCode, normalizeAccount, normalizeSecret, parseOtpUri, toOtpUri } from '../src/domain/otp.js'
import { exportConfig, importConfig } from '../src/domain/config.js'

const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const base32 = text => {
    const bits = [...new TextEncoder().encode(text)].map(value => value.toString(2).padStart(8, '0')).join('')
    return bits.match(/.{1,5}/g).map(value => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[parseInt(value.padEnd(5, '0'), 2)]).join('')
}
const vectors = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1111111111, '14050471', '67062674', '99943326'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
]
test('RFC 6238 vectors: SHA1, SHA256, SHA512, 8 digits and leading zeroes', async () => {
    for (const [column, algorithm, length] of [[1, 'SHA1', 20], [2, 'SHA256', 32], [3, 'SHA512', 64]]) {
        for (const row of vectors) {
            const id = base32('1234567890'.repeat(7).slice(0, length))
            assert.equal(await generateCode({ id, algorithm, digits: 8 }, row[0] * 1000), row[column])
        }
    }
})
test('six-digit defaults, exact period boundaries, custom period', async () => {
    assert.equal(await generateCode({ id: secret }, 59000), '287082')
    assert.equal(await generateCode({ id: secret }, 29999), await generateCode({ id: secret }, 0))
    assert.notEqual(await generateCode({ id: secret }, 30000), await generateCode({ id: secret }, 29999))
    assert.equal(await generateCode({ id: secret, period: 60 }, 60000), await generateCode({ id: secret }, 30000))
})
test('normalization preserves legacy accounts and rejects malformed parameters', () => {
    assert.deepEqual(normalizeAccount({ id: secret.toLowerCase(), title: ' 工作 ' }), { id: secret, title: '工作', algorithm: 'SHA1', digits: 6, period: 30 })
    assert.equal(normalizeSecret('my======'), 'MY')
    for (const id of ['', 'A', 'ABC', 'A1AAAAAA', 'MZ', 'MY=bad']) assert.throws(() => normalizeSecret(id))
    for (const override of [{ algorithm: 'MD5' }, { digits: 7 }, { period: 0 }, { period: 1.5 }, { title: {} }]) assert.throws(() => normalizeAccount({ id: secret, ...override }))
})
test('otpauth QR round trip retains Unicode, URL characters and advanced parameters', () => {
    const account = normalizeAccount({ id: secret, title: '工作 & GitHub: a/b?#', algorithm: 'SHA512', digits: 8, period: 60 })
    assert.deepEqual(parseOtpUri(toOtpUri(account)), account)
    assert.equal(parseOtpUri(`otpauth://totp/user?secret=${secret}&issuer=GitHub`).title, 'GitHub: user')
    assert.throws(() => parseOtpUri(`otpauth://hotp/user?secret=${secret}&counter=1`))
    assert.throws(() => parseOtpUri('https://example.com'))
    assert.throws(() => parseOtpUri('otpauth://totp/test'))
})
test('JSON and YAML backups use secret, preserve order and safely escape text', () => {
    const list = [{ id: secret, title: '<>&"\'\\\n```' }, { id: 'JBSWY3DPEHPK3PXP', title: '个人', period: 60 }].map(normalizeAccount)
    for (const format of ['json', 'yaml']) assert.deepEqual(importConfig(exportConfig(list, format)), list)
    assert.equal(JSON.parse(exportConfig(list, 'json')).list[0].secret, secret)
    assert.equal(Object.hasOwn(JSON.parse(exportConfig(list, 'json')).list[0], 'id'), false)
    assert.deepEqual(importConfig(JSON.stringify(list)), list)
    assert.deepEqual(importConfig('\uFEFF' + exportConfig(list, 'json')), list)
    assert.throws(() => importConfig('{ broken'))
    assert.throws(() => importConfig('{"version":2,"list":[]}'))
    assert.throws(() => importConfig('{"list":[{"id":"invalid!"}]}'))
    assert.throws(() => exportConfig(list, 'csv'))
})

test('YAML schema rejects ambiguous or malformed fields and handles empty lists', () => {
    assert.deepEqual(importConfig(exportConfig([], 'yaml')), [])
    assert.throws(() => exportConfig([], 'yml'))
    assert.deepEqual(importConfig('---\n# backup\n' + exportConfig([{ secret, title: '0012: # \"中文\"' }], 'yaml') + '...\n'), [normalizeAccount({ secret, title: '0012: # \"中文\"' })])
    for (const source of [
        'version: 2\nlist: []',
        'version: 1\nversion: 1\nlist: []',
        'list: []\nlist: []',
        'list:\n  - secret: "' + secret + '"\n    secret: "' + secret + '"',
        'list:\n  - secret: *alias',
        'list:\n  - secret: !tagged',
        'list:\n  - secret: "unterminated',
        'list:\n  - unknown: "text"',
        'list:\n\t- secret: "' + secret + '"',
        '# Backup\n```json\n{"list": []}\n```',
    ]) assert.throws(() => importConfig(source), source)
})

test('legacy unnamed accounts retain a usable title after normalization', () => {
    assert.equal(normalizeAccount({ id: secret, title: '  ' }).title, t('unnamed'))
    assert.equal(normalizeAccount({ id: secret }).title, t('unnamed'))
})
