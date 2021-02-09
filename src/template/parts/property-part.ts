import {Component, getComponentEarly} from '../../component'


/**
 * Assigns property directly to current component or element.
 * 
 * `<tag .property=${...}>` will assign value to normal element according to `element.property = value`.
 * `<custom-tag .property=${...}>` will assign value to component according to `com.property = value`.
 * `<custom-tag ..property=${...}>` will always assign value to element.
 * 
 * But still don't suggest to assign properties to normal element using `.`, you should use element attributes.
*/
export class PropertyPart implements Part {

	private readonly el: Element
	private readonly name: string
	private readonly isComProperty: boolean

	/** Indicates that the value to assign is fixed, likes `.property="3"`. */
	private readonly fixed: boolean

	private com: Component | null = null

	constructor(el: Element, name: string, value: unknown, fixed: boolean) {
		this.el = el
		this.name = name[0] === '.' ? name.slice(1) : name
		this.isComProperty = el.localName.includes('-') && name[0] !== '.'
		this.fixed = fixed

		this.update(value)
	}

	update(value: unknown) {
		if (this.isComProperty) {
			if (this.com) {
				this.updateComProperty(value)
			}
			else {
				getComponentEarly(this.el as HTMLElement, com => {
					this.bindCom(com!)
					this.updateComProperty(value)
				})
			}
		}
		else {
			this.updateElementProperty(value)
		}
	}

	private bindCom(com: Component) {
		this.com = com
	}

	private updateComProperty(value: unknown) {
		if (this.fixed) {
			this.updateFixedComProperty(value as string)
		}
		else {
			(this.com as any)[this.name] = value
		}
	}

	private updateFixedComProperty(value: string) {
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

	remove() {}
}