import {getComponentConstructor} from './component'


/**
 * Render html codes to elements. Returns the element.
 * @param htmlCodes The html code piece for one element.
 * @param target If specified, the element will be appended to it after created.
 */
export function render(htmlCodes: string, target?: HTMLElement): DocumentFragment

/**
 * Render html codes to an element. Can specify options if it's an component. Returns the element.
 * @param htmlCodes The html code piece for one element.
 * @param options If you need to create comonent, it's the options to instantiate component
 * @param target If specified, the element will be appended to it after created.
 */
export function render(htmlCodes: string, options: object, target?: HTMLElement): DocumentFragment

export function render(htmlCodes: string, options?: null | object | HTMLElement, target?: HTMLElement): DocumentFragment {
	let template = document.createElement('template')
	template.innerHTML = clearWhiteSpaces(htmlCodes)

	if (options instanceof HTMLElement) {
		target = options
		options = null
	}

	if (options) {
		let fragment = template.content
		if (fragment.children.length > 1) {
			throw new Error('Only one element is allowed when "render" an component')
		}

		if (!fragment.firstElementChild) {
			throw new Error('One element is required when "render" an component')
		}

		let tagName = fragment.firstElementChild.localName
		let Com = getComponentConstructor(tagName)
		
		if (!Com) {
			throw new Error(`"${tagName}" is not defined as an component`)
		}

		new Com(fragment.firstElementChild as HTMLElement, options)
	}

	if (target) {
		target.append(template.content)
	}

	return template.content
}


function clearWhiteSpaces(htmlCodes: string): string {
	return htmlCodes.trimLeft().replace(/>[ \t\r\n]+/g, '>')
}
