import {Binding, defineBinding} from './define'
import type {Context} from '../component'
import {getScopedClassNames} from '../internals/style-parser'


/** Object used for `:class=${{class1: value1, class2: value2}}` */
type ClassObject = Record<string, string | number>


/**
 * `:class` binding will add class names to current element.
 * 
 * `:class="class1 class2"` - Like class name strings.
 * `:class.class-name=${booleanValue}` - Add class name if booleanValue is `true`.
 * `:class=${[class1, class2]}` - Add multiply class names from array.
 * `:class=${{class1: value1, class2: value2}}` - Add multiply class names from their mapped boolean values.
 */
@defineBinding('class')
export class ClassNameBinding implements Binding<string | ClassObject> {

	private readonly el: Element
	private readonly modifiers: string[] | undefined

	/** Current component name to identify class scope. */
	private readonly scopeName: string

	/** All the scoped class names. */
	private readonly scopedClassNames: Set<string> | undefined

	private lastClassNames: string[] = []

	constructor(el: Element, context: Context, modifiers?: string[]) {
		if (modifiers) {
			if (modifiers.length > 1) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most one modifier as class name can be specified for ":class"!`)
			}

			if (!/^\$?[\w-]+$/.test(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid class name!`)
			}
		}

		this.el = el
		this.modifiers = modifiers
		this.scopeName = context?.el.localName || ''
		this.scopedClassNames = this.scopeName ? getScopedClassNames(this.scopeName) : undefined
	}

	update(value: string | ClassObject) {
		let newClassNames: string[] = []

		if (value) {
			newClassNames = this.parseClass(value)
		}

		for (let name of this.lastClassNames) {
			if (!newClassNames.includes(name)) {
				this.el.classList.remove(name)
			}
		}

		for (let name of newClassNames) {
			if (!this.lastClassNames.includes(name)) {
				this.el.classList.add(name)
			}
		}
		
		this.lastClassNames = newClassNames
	}

	private parseClass(value: string | ClassObject): string[] {
		let o: Record<string, boolean> = {}

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
				if (this.scopedClassNames && this.scopedClassNames.has(name)) {
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
}
