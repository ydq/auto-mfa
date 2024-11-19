import OTP from 'otp'

const initCtxMenu = async otps => {
    await chrome.contextMenus.removeAll()
    otps.forEach(async ({ id, title }) => {
        title = title || `未命名_${Math.random().toString(26).substr(2).toUpperCase()}`
        await chrome.contextMenus.create({
            id,
            title,
            contexts: ['editable']
        })
    })
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        try {
            await chrome.tabs.sendMessage(tab.id, new OTP({ secret: info.menuItemId }).totp())
        } catch (e) {
        }
    })
}

//更新otp配置之后刷新菜单
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    const otps = await chrome.storage.sync.get()
    await initCtxMenu(otps.list ?? [])
});

//初始化菜单
chrome.storage.sync.get().then(async otps => {
    await initCtxMenu(otps.list ?? [])
})
