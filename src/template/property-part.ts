import {Part} from './types'
import {Component, getComponent, onComponentCreatedAt} from '../component'


/**
 * `.property=${...}` will assign value to element by `element.property = value`.
 * `.property=${...}` will assign value to component by `com.property = value` if on custom element.
 * `..property=${...}` will always assign value to element.
*/
export class PropertyPart implements Part {

	private el: Element
	private name: string
	private com: Component | null = null
	private isComProperty: boolean
	private value: unknown = undefined
	private fixed: boolean

	constructor(el: Element, name: string, value: unknown, fixed: boolean) {
		this.el = el
		this.name = name[0] === '.' ? name.slice(1) : name
		this.isComProperty = el.localName.includes('-') && name[0] !== '.'
		this.fixed = fixed

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
		if (this.fixed) {
			this.setFixedComProperty(value as string)
		}
		else {
			(this.com as any)[this.name] = value
		}
	}

	private setFixedComProperty(value: string) {
		let com = this.com as any
		let type = typeof com[this.name]

		if (type === 'object' && !/^\s*(?:\{.+?\}|\[.+?\])\s*$/.test(value)) {
			type = 'string'
		}

		switch (type) {
			case 'boolean':
				com[this.name] = value === 'false' ? false : true
				break

			case 'number':
				com[this.name] = Number(value)
				break

			case 'object':
				com[this.name] = JSON.parse(value)
				break
			
			default:
				if (type !== 'undefined') {
					com[this.name] = value
				}
				else {
					console.warn(`Please makesure value of property "${this.name}" exist on "<${com.el.localName} />" when assigning fixed property!`)
				}
		}
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
			this.updateElementProperty(value)
		}
	}

	remove() {}
}