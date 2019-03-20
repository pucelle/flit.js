import {Part, PartType} from './shared'


export class MayAttrPart implements Part {
	type = PartType.MayAttr
	width = 1
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

	merge(value: any) {
		this.setValue(value)
	}
}