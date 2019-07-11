import {MayStringValuePart, PartType} from './shared'
import {Component, getComponent, onComponentCreatedAt} from '../component'


/**
 * `.property=${...}` will assign value to element by `element.property = value`.
 * `.comProperty=${...}` will assign value to component by `com.property = value`.
 * `..property=${...}` to always assign to element.
*/
export class PropertyPart implements MayStringValuePart {

	type: PartType = PartType.Property
	strings: string[] | null = null

	private el: Element
	private name: string
	private com: Component | null = null
	private isComProperty: boolean
	private value: unknown = undefined

	constructor(el: Element, name: string, value: unknown) {
		this.el = el
		this.name = name[0] === '.' ? name.slice(1) : name
		this.isComProperty = el.localName.includes('-') && name[0] !== '.'

		if (this.isComProperty) {
			this.bindCom()
			this.updateComProperty(value)
		}
		else {
			this.updateElementProperty(value)
		}
	}

	private bindCom() {
		let com = getComponent(this.el as HTMLElement)
		if (com) {
			this.com = com
		}
		else {
			onComponentCreatedAt(this.el as HTMLElement, this.onComCreated.bind(this))
		}
	}

	private onComCreated(com: Component) {
		this.com = com
		this.setComProperty(this.value)
		this.value = undefined	
	}

	private updateComProperty(value: unknown) {
		if (this.com) {
			this.setComProperty(value)
		}
		else {
			this.value = value
		}
	}

	private setComProperty(value: unknown) {
		(this.com as any)[this.name] = value
	}

	private updateElementProperty(value: unknown) {
		// Required, set same value for `<input type="text">` may cause cursor position reset.
		if ((this.el as any)[this.name] !== value) {
			(this.el as any)[this.name] = value
		}
	}

	update(value: unknown) {
		if (this.isComProperty) {
			this.updateComProperty(value)
		}
		else {
			this.updateComProperty(value)
		}
	}

	remove() {}
}