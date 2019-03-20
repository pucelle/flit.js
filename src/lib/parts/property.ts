import {Part, PartType} from './shared'
import {joinStringsAndValue} from '../template'


export class PropertyPart implements Part {
	type = PartType.Property
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
		}

		(this.el as any)[this.name] = value
	}

	merge(values: any) {
		this.setValues(values)
	}
}