import OTP from 'otp'

const func = otp => {
    let dom = document.activeElement
    while (dom.tagName == 'IFRAME' || dom.tagName == 'FRAME') {
        dom = dom.contentDocument.activeElement
    }
    dom.value = otp
    //部分框架双向数据绑定，直接设置元素的值还不行，需要触发一下 input 或者 change 事件
    dom.dispatchEvent(new Event('input', { bubbles: true }))
    dom.dispatchEvent(new Event('change', { bubbles: true }))
}

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

//给右键菜单绑定事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    chrome.scripting.executeScript({
        args: [new OTP({ secret: info.menuItemId }).totp()],
        target: { tabId: tab.id },
        func
    })
})
