import {MayStringValuePart, PartType} from "./types"


/**
 * .property="${...}", which will be assigned by `element.property = value`.
 */
export class PropertyPart implements MayStringValuePart {

	type: PartType = PartType.Property
	strings: string[] | null = null

	private el: HTMLElement
	private name: string

	constructor(el: HTMLElement, name: string, value: unknown) {
		this.el = el
		this.name = name
		this.setValue(value)
	}

	private setValue(value: unknown) {
		(this.el as any)[this.name] = value
	}

	update(value: unknown) {
		this.setValue(value)
	}
}