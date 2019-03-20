import {Part, PartType} from './shared'


export class PropertyPart implements Part {

	type: PartType = PartType.Property
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
		(this.el as any)[this.name] = value
	}

	update(values: any) {
		this.setValue(values)
	}
}