import {Part, PartType} from './shared'
import {joinStringsAndValue} from '../template'


export class BindPart implements Part {
	type = PartType.Bind
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

		//TODO
	}

	merge(values: any) {
		this.setValues(values)
	}
}