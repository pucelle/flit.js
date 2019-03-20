import {Part, PartType} from './shared'


export class AttrPart implements Part {

	type: PartType = PartType.Attr
	width: number = 1
	strings: string[] | null = null

	private el: HTMLElement
	private name: string

	constructor(el: HTMLElement, name: string, value: any) {
		this.el = el
		this.name = name
		this.setValue(value)
	}

	private setValue(value: any) {
		value === null || value === undefined ? '' : String(value)
		this.el.setAttribute(this.name, value)
	}

	update(values: any) {
		this.setValue(values)
	}
}