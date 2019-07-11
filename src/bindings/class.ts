import {Binding, defineBinding} from './define'
import {getScopedClassNameSet} from '../style'
import {Context} from '../component'


interface ClassObject {
	[key: string]: any
}

/**
 * `:class="'class1 class2'"`
 * `:class="[class1, class2]"`
 * `:class="{class1: value1, class2: value2}"`
 * `:class.class-name="value"`
 */
defineBinding('class', class ClassNameBinding implements Binding<[string | ClassObject]> {

	private el: Element
	private modifiers: string[] | null
	private lastClassNames: string[] | null = null
	private scopeName: string
	private scopedClassNameSet: Set<string> | undefined

	constructor(el: Element, modifiers: string[] | null, context: Context) {
		if (modifiers) {
			if (modifiers.length > 1) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most one modifier as class name can be specified for ":class"`)
			}

			if (!/^\$?[\w-]+$/.test(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid class name`)
			}
		}

		this.el = el
		this.modifiers = modifiers
		this.scopeName = context ? context.el.localName : ''
		this.scopedClassNameSet = this.scopeName ? getScopedClassNameSet(this.scopeName) : undefined
	}

	update(value: string | ClassObject) {
		if (this.lastClassNames) {
			this.el.classList.remove(...this.lastClassNames)
		}

		if (value) {
			let classNames = this.lastClassNames = this.parseClass(value)
			this.el.classList.add(...classNames)
		}
	}

	private parseClass(value: string | ClassObject): string[] {
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
				if (this.scopedClassNameSet && this.scopedClassNameSet.has(name)) {
					name = name + '__' + this.scopeName
				}

				names.push(name)
			}
		}

		return names
	}

	remove() {
		if (this.lastClassNames) {
			this.el.classList.remove(...this.lastClassNames)
		}
	}
})
