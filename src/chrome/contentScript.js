chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
	let dom = document.activeElement;
	while (dom.tagName == 'IFRAME' || dom.tagName == 'FRAME') {
		dom = dom.contentDocument.activeElement;
	}
	dom.value = request;
	//部分框架双向数据绑定，直接设置元素的值还不行，需要触发一下 input 或者 change 事件
	dom.dispatchEvent(new Event('input', { bubbles: true }))
	dom.dispatchEvent(new Event('change', { bubbles: true }))
})