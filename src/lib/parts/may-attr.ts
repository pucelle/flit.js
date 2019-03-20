import {Part, PartType} from './shared'


export class MayAttrPart implements Part {

	type: PartType = PartType.MayAttr
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
		if (value) {
			this.el.setAttribute(this.name, '')
		}
		else {
			this.el.removeAttribute(this.name)
		}
	}

	update(value: any) {
		this.setValue(value)
	}
}