import {Part} from './types'


/**
 * `attr=${...}`, set attribute value.
 */
export class AttrPart implements Part {

	private el: Element
	private name: string

	constructor(el: Element, name: string, value: unknown) {
		this.el = el
		this.name = name
		this.setValue(value)
	}

	private setValue(value: unknown) {
		value === null || value === undefined ? '' : String(value)
		this.el.setAttribute(this.name, value as string)
	}

	update(value: unknown) {
		this.setValue(value)
	}

	remove() {}
}