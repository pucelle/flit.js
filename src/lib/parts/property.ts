import {MayStringValuePart, PartType} from './shared'


/**
 * `.property=${...}`, will assign value to element by `element.property = value`.
 */
export class PropertyPart implements MayStringValuePart {

	type: PartType = PartType.Property
	strings: string[] | null = null

	private el: Element
	private name: string

	constructor(el: Element, name: string, value: unknown) {
		this.el = el
		this.name = name
		this.setValue(value)
	}

	private setValue(value: unknown) {
		// Required, set same value for `<input type="text">` may cause cursor position reset.
		if ((this.el as any)[this.name] !== value) {
			(this.el as any)[this.name] = value
		}
	}

	update(value: unknown) {
		this.setValue(value)
	}

	remove() {}
}