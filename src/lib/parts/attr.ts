import {Part, PartType} from './shared'
import {joinStringsAndValue} from '../template'


export class AttrPart implements Part {
	type = PartType.Attr
	width: number
	private el: HTMLElement
	private name: string
	private strings: string[] | null

	constructor(el: HTMLElement, name: string, strings: string[] | null, values: any[]) {
		this.el = el
		this.name = name
		this.width = strings ? strings.length - 1 : 1
		this.strings = strings
		this.setValues(values)
	}

	private setValues(values: any[]) {
		let value: string

		if (this.strings) {
			value = joinStringsAndValue(this.strings, values)
		}
		else {
			value = values[0]
			value === null || value === undefined ? '' : String(value)
		}

		this.el.setAttribute(this.name, value)
	}

	merge(values: any) {
		this.setValues(values)
	}
}