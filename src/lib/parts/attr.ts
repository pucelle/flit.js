import {Part, PartType} from "./types"


export class AttrPart implements Part {

	type: PartType = PartType.Attr
	width: number = 1
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

	update(values: unknown) {
		this.setValue(values)
	}
}