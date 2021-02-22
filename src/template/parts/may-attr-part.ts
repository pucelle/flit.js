import {Part} from './types'


/**
 *  Keeps the attribute if expression returns `true`, otherwise removes the attribute.
 * 
 * `?checked=${...}`
 * `?disabled=${...}`
 */
export class MayAttrPart implements Part {

	private readonly el: Element
	private readonly name: string

	constructor(el: Element, name: string) {
		this.el = el
		this.name = name
	}

	update(value: unknown) {
		this.setValue(value)
	}

	private setValue(value: unknown) {
		if (value) {
			this.el.setAttribute(this.name, '')
		}
		else {
			this.el.removeAttribute(this.name)
		}
	}
}