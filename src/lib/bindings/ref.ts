import {Binding, defineBinding} from './define'
import {Component, Context} from '../component'


/**
 * `:ref="name"`
 * `:ref="${this.onRef}"`
 */
defineBinding('ref', class RefBinding implements Binding {

	private el: Element
	private context: Component

	constructor(el: Element, value: unknown, _modifiers: string[] | null, context: Context) {
		if (!context) {
			throw new Error(`A context must be provided when registering ":ref"`)
		}

		this.el = el
		this.context = context
		this.update(value)
	}

	update(value: unknown) {
		if (typeof value === 'string') {
			this.context.refs[value] = this.el as HTMLElement
		}
		else if (typeof value === 'function') {
			value.call(this.context, this.el)
		}
	}
})
