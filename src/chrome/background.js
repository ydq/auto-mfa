import { t } from '../i18n/index.js'
import { generateCode } from '../domain/otp.js'
import { createConfigStorage } from '../services/configStorage.js'

const storage = createConfigStorage()

const fillInput = code => {
    let element = document.activeElement
    try {
        while (element?.tagName === 'IFRAME' || element?.tagName === 'FRAME') element = element.contentDocument?.activeElement
    } catch { return }
    if (!element) return
    if (element.isContentEditable) element.textContent = code
    else {
        // Native setter also notifies frameworks that track an input's current value.
        const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
        if (!setter || !['INPUT', 'TEXTAREA'].includes(element.tagName)) return
        setter.call(element, code)
    }
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
}

let menuUpdate = Promise.resolve()
function refreshMenus() {
    menuUpdate = menuUpdate.catch(() => {}).then(async () => {
        const { list } = await storage.load()
        await chrome.contextMenus.removeAll()
        const seen = new Set()
        for (const account of list) {
            if (seen.has(account.id)) continue
            seen.add(account.id)
            await new Promise((resolve, reject) => {
                chrome.contextMenus.create({ id: account.id, title: account.title, contexts: ['editable'] }, () => {
                    const error = chrome.runtime.lastError
                    if (error) reject(new Error(error.message))
                    else resolve()
                })
            })
        }
    })
    menuUpdate.catch(error => console.error(t('menuFailed'), error.message))
}
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'sync' && (changes.list || changes.version)) refreshMenus() })
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const { warning } = await storage.load({ migrate: true })
        if (warning) console.warn(t('storageMaintenancePending'))
    } catch (error) { console.error(t('storageMaintenancePending'), error.message) }
    refreshMenus()
})
chrome.runtime.onStartup.addListener(refreshMenus)
refreshMenus()

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return
    try {
        const { list } = await storage.load()
        const account = list.find(item => item.id === info.menuItemId)
        if (!account) return
        await chrome.scripting.executeScript({
            args: [await generateCode(account)],
            target: { tabId: tab.id, ...(info.frameId !== undefined ? { frameIds: [info.frameId] } : {}) },
            func: fillInput,
        })
    } catch (error) { console.error(t('autofillFailed'), error.message) }
})
