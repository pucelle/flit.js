export function trim(text: string) {
	return text.replace(/^[\r\n\t]+|[\r\n\t]+$/g, '')
}


export function cloneAttributes(el: Element, attributes: {name: string, value: string}[]) {
	for (let {name, value} of attributes) {
		if ((name === 'class' || name === 'style') && el.hasAttribute(name)) {
			if (name === 'style') {
				value = (el.getAttribute(name) as string) + '; ' + value
			}
			else if (name === 'class') {
				value = (el.getAttribute(name) as string) + ' ' + value
			}
		}

		el.setAttribute(name, value)
	}
}