import {Binding, defineBinding} from './define'


/** Type of style object. */
type StyleObject = Record<string, string | number>


/** All modifiers for style binding. */
const AllowedStyleModifiers = ['px', 'percent', 'url']


/**
 * `:style` binding will update style values for current element.
 * 
 * `:style="normalStyleProperties"` - Just like normal style properties.
 * `:style.style-name=${value}` - Set style value for specified style proeprty.
 * `:style.style-name.px=${numberValue}` - Convert numberValue to `?px` and set as style value.
 * `:style=${{styleName1: value1, styleName2: value2}}` - Add multiply styles from properties and mapped values.
 */
@defineBinding('style')
export class StyleBinding implements Binding<string | StyleObject> {

	private readonly el: HTMLElement | SVGElement
	private readonly modifiers: string[] | undefined

	private lastStyle: StyleObject = {}

	constructor(el: Element, _context: any, modifiers?: string[]) {
		if (modifiers) {
			if (modifiers.length > 2) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most two modifiers (as style name property value modifier) can be specified for ":style"!`)
			}

			if (modifiers.length === 2 && !AllowedStyleModifiers.includes(modifiers[1])) {
				throw new Error(`Modifier "${modifiers[1]}" is not allowed, it must be one of ${AllowedStyleModifiers.join(', ')}!`)
			}

			if (!/^[\w-]+$/.test(modifiers[0]) || AllowedStyleModifiers.includes(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid style property!`)
			}
		}

		this.el = el as HTMLElement | SVGElement
		this.modifiers = modifiers
	}

	update(value: string | StyleObject) {
		let oldStyleNames = Object.keys(this.lastStyle)
		let newStyle = this.parseStyle(value)
		let newStyleNames = Object.keys(newStyle)

		for (let name of oldStyleNames) {
			if (!newStyleNames.includes(name)) {
				(this.el.style as any)[name] = ''
			}
		}

		for (let name of newStyleNames) {
			if (!oldStyleNames.includes(name) || this.lastStyle[name] !== newStyle[name]) {
				this.setStyle(name, newStyle[name])
			}
		}

		this.lastStyle = newStyle
	}

	private setStyle(name: string, value: unknown) {
		let unit = this.modifiers?.[1] || ''
		
		if (value === null || value === undefined) {
			value = ''
		}
		else if (unit === 'px') {
			// More units like `s`, `deg` is very rare to use.
			value = value + 'px'
		}
		else if (unit === 'percent') {
			value = value + '%'
		}
		else if (unit === 'url') {
			value = 'url("' + value + '")'
		}
		else {
			value = String(value)
		}

		(this.el.style as any)[name] = value
	}

	private parseStyle(style: unknown): StyleObject {
		let o: StyleObject = {}

		if (this.modifiers) {
			if (typeof style === 'string' && style !== '' || typeof style === 'number') {
				o[this.modifiers[0]] = style
			}
		}
		else if (Array.isArray(style)) {
			for (let item of style.join(';').split(/\s*;\s*/)) {
				let [name, value] = item.split(/\s*:\s*/)
				if (name && value) {
					o[name] = value
				}
			}
		}
		else if (style && typeof style === 'object') {
			o = style as StyleObject
		}
		else if (style && typeof style === 'string') {
			for (let item of style.split(/\s*;\s*/)) {
				let [name, value] = item.split(/\s*:\s*/)
				if (name && value) {
					o[name] = value
				}
			}
		}

		return o
	}

	remove() {
		if (this.lastStyle) {
			for (let name of Object.keys(this.lastStyle)) {
				(this.el.style as any)[name] = ''
			}
		}
	}
}
