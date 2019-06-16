import {Binding, defineBinding} from './define'
import {Component, Context} from '../component'


/**
 * `:ref="name"`
 * `:ref="${this.onRef}"`
 */
defineBinding('ref', class RefBinding implements Binding<[string | ((el: Element) => void)]> {

	private el: Element
	private context: Component

	constructor(el: Element, _modifiers: string[] | null, context: Context) {
		if (!context) {
			throw new Error(`A context must be provided when using ":ref"`)
		}

		this.el = el
		this.context = context
	}

	update(value: string | ((el: Element) => void)) {
		if (typeof value === 'string') {
			this.context.refs[value] = this.el as HTMLElement
		}
		else if (typeof value === 'function') {
			value.call(this.context, this.el)
		}
	}

	remove() {}
})
