import type {Component, Context} from '../component'
import {Binding, defineBinding} from './define'


/**
 * To reference current element as a `refs` property or captures and passes to a handler.
 * 
 * `:ref="name"` - Reference as a value in current component at `.refs.refName`, note it will be updated everytime after element changed.
 * `:ref=${this.onRef}` - Call reference function with current element as parameter, note it will be called everytime after element changed.
 */
@defineBinding('ref')
export class RefBinding implements Binding<string | ((el: Element) => void)> {

	private readonly el: Element
	private readonly context: Component

	constructor(el: Element, context: Context) {
		if (!context) {
			throw new ReferenceError(`A context must be provided when using ":ref" binding!`)
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
}
