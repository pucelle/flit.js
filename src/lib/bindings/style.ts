import {Binding, defineBinding} from './define'


/**
 * `:style="'style1: value1; style2: value2'"`
 * `:style="{style1: value1, style2: value2}"`
 * `:style.style-name="value"`
 * `:style.style-name.px="value"`
 */
defineBinding('style', class StyleBinding implements Binding {

	private el: HTMLElement
	private modifiers: string[] | null
	private value: unknown = null
	private allowedModifiers = ['px', 'percent', 'url']

	constructor(el: HTMLElement, value: unknown, modifiers: string[] | null) {
		if (modifiers) {
			if (modifiers.length > 2) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most two modifiers can be specified for ":style"`)
			}

			if (modifiers.length === 2 && !this.allowedModifiers.includes(modifiers[1])) {
				throw new Error(`Modifier "${modifiers[1]}" is not allowed, it must be one of ${this.allowedModifiers.map(m => `"${m}"`).join(', ')}`)
			}

			if (!/^[\w-]+$/.test(modifiers[0]) || this.allowedModifiers.includes(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid dash case style name`)
			}
		}

		this.el = el
		this.modifiers = modifiers
		this.update(value)
	}

	update(newValue: unknown) {
		if (this.value) {
			this.removeStyle(this.value)
		}

		if (newValue) {
			this.addStyle(newValue)
		}

		this.value = newValue
	}

	removeStyle(style: unknown) {
		let o = this.parseStyle(style)
		
		for (let name of Object.keys(o)) {
			(this.el.style as any)[name] = ''
		}
	}

	addStyle(style: unknown) {
		let o = this.parseStyle(style)
		let unit = this.modifiers ? this.modifiers[1] : ''
		
		for (let name of Object.keys(o)) {
			let value = o[name]

			if (value === null || value === undefined) {
				value = ''
			}
			else if (unit === 'px') {
				value = value + 'px'
			}
			else if (unit === 'percent') {
				value = value + '%'
			}
			else if (unit === 'url') {
				value = 'url("' + value + '")'
			}

			(this.el.style as any)[name] = value
		}
	}

	parseStyle(style: unknown): {[key: string]: unknown} {
		let obj: {[key: string]: unknown} = {}

		if (this.modifiers) {
			if (style && style !== null && style !== undefined) {
				obj[this.modifiers[0]] = style
			}
		}
		else if (Array.isArray(style)) {
			for (let item of style.join(';').split(/\s*;\s*/)) {
				let [name, value] = item.split(/\s*:\s*/)
				if (name && value) {
					obj[name] = value
				}
			}
		}
		else if (style && typeof style === 'object') {
			obj = style as any
		}
		else if (style && typeof style === 'string') {
			for (let item of style.split(/\s*;\s*/)) {
				let [name, value] = item.split(/\s*:\s*/)
				if (name && value) {
					obj[name] = value
				}
			}
		}

		return obj
	}
})
