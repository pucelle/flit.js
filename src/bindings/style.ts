import {Binding, defineBinding} from './define'


const ALLOWED_MODIFIERS = ['px', 'percent', 'url']


/**
 * `:style="'style1: value1; style2: value2'"`
 * `:style="{style1: value1, style2: value2}"`
 * `:style.style-name="value"`
 * `:style.style-name.px="value"`
 */
type StyleObject = {[key: string]: unknown}

defineBinding('style', class StyleBinding implements Binding<[string | StyleObject]> {

	private el: HTMLElement | SVGElement
	private modifiers: string[] | undefined
	private lastStyle: StyleObject | null = null

	constructor(el: Element, _context: any, modifiers?: string[]) {
		if (modifiers) {
			if (modifiers.length > 2) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most two modifiers (as style name property value modifier) can be specified for ":style"`)
			}

			if (modifiers.length === 2 && !ALLOWED_MODIFIERS.includes(modifiers[1])) {
				throw new Error(`Modifier "${modifiers[1]}" is not allowed, it must be one of ${ALLOWED_MODIFIERS.join(', ')}`)
			}

			if (!/^[\w-]+$/.test(modifiers[0]) || ALLOWED_MODIFIERS.includes(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid style property`)
			}
		}

		this.el = el as HTMLElement | SVGElement
		this.modifiers = modifiers
	}

	update(value: string | StyleObject) {
		if (this.lastStyle) {
			this.removeStyle(this.lastStyle)
		}

		if (value !== '' && value !== null && value !== undefined) {
			this.addStyle(this.lastStyle = this.parseStyle(value))
		}
	}

	private removeStyle(style: StyleObject) {
		for (let name of Object.keys(style)) {
			(this.el.style as any)[name] = ''
		}
	}

	private addStyle(style: StyleObject) {
		let unit = this.modifiers ? this.modifiers[1] : ''
		
		for (let name of Object.keys(style)) {
			let value = style[name]

			if (value === null || value === undefined) {
				value = ''
			}

			// Units like `s`, `deg` is very rare to use.
			else if (unit === 'px') {
				value = value + 'px'
			}
			else if (unit === 'percent') {
				value = value + '%'
			}
			else if (unit === 'url') {
				value = 'url("' + value + '")'
			}

			if (typeof value === 'number') {
				value = value + 'px'
			}

			(this.el.style as any)[name] = value
		}
	}

	private parseStyle(style: unknown): StyleObject {
		let o: StyleObject = {}

		if (this.modifiers) {
			if (style !== '' && style !== null && style !== undefined) {
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
			o = style as any
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
			this.removeStyle(this.lastStyle)
		}
	}
})
