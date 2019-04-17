import {Part, PartType} from "./shared"


/**
 * ?checked="${...}", remove the attribute if expression returns false.
 */
export class MayAttrPart implements Part {

	type: PartType = PartType.MayAttr

	private el: Element
	private name: string

	constructor(el: Element, name: string, value: unknown) {
		this.el = el
		this.name = name
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

	update(value: unknown) {
		this.setValue(value)
	}

	remove() {}
}