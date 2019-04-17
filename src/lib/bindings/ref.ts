import {Binding, defineBinding} from './define'
import {Component} from '../component'


/**
 * `:ref="name"`
 * `:ref="${this.onRef}"`
 */
defineBinding('ref', class RefBinding implements Binding {

	private el: Element
	private context: Component

	constructor(el: Element, value: unknown, _modifiers: string[] | null, context: Component) {
		this.el = el
		this.context = context
		this.update(value)
	}

	update(value: unknown) {
		if (typeof value === 'string') {
			this.context.refs[value] = this.el
		}
		else if (typeof value === 'function') {
			value.call(this.context, this.el)
		}
	}
})
