import {MayStringValuePart, PartType} from "./types"


/**
 * attr="${...}"
 */
export class AttrPart implements MayStringValuePart {

	type: PartType = PartType.Attr
	strings: string[] | null = null

	private el: HTMLElement
	private name: string

	constructor(el: HTMLElement, name: string, value: unknown) {
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