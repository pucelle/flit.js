import {Binding, defineBinding} from './define'


/**
 * `:class="'class1 class2'"`
 * `:class="[class1, class2]"`
 * `:class="{class1: value1, class2: value2}"`
 * `:class.class-name="value"`
 */
defineBinding('class', class ClassNameBinding implements Binding {

	private el: HTMLElement
	private modifiers: string[] | null
	private value: unknown = null

	constructor(el: HTMLElement, value: unknown, modifiers: string[] | null) {
		if (modifiers) {
			if (modifiers.length > 1) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most one modifier can be specified for ":class"`)
			}

			if (!/^[\w-]+$/.test(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid class name`)
			}
		}

		this.el = el
		this.modifiers = modifiers
		this.update(value)
	}

	update(newValue: unknown) {
		if (this.value) {
			this.removeClass(this.value)
		}

		if (newValue) {
			this.addClass(newValue)
		}

		this.value = newValue
	}

	removeClass(value: unknown) {
		let names = this.parseClass(value)
		this.el.classList.remove(...names)
	}

	addClass(value: unknown) {
		let names = this.parseClass(value)
		this.el.classList.add(...names)
	}

	parseClass(value: unknown): string[] {
		let o: {[key: string]: boolean} = {}

		if (this.modifiers) {
			if (value) {
				o[this.modifiers[0]] = true
			}
		}
		else if (Array.isArray(value)) {
			for (let name of value) {
				o[name] = true
			}
		}
		else if (value && typeof value === 'object') {
			for (let key of Object.keys(value as any)) {
				o[key] = !!(value as any)[key]
			}
		}
		else if (typeof value === 'string') {
			for (let name of value.split(/\s+/)) {
				if (name) {
					o[name] = true
				}
			}
		}

		let names: string[] = []

		for (let name in o) {
			if (o[name]) {
				names.push(name)
			}
		}

		return names
	}
})
