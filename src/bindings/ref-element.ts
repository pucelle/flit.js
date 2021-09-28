import type {Component, Context} from '../component'
import {Binding, defineBinding} from './define'


/**
 * To reference current element as a `refElements` property or captures and passes to a handler.
 * 
 * `:refElement="name"` - Reference as a value in current component at `.refElements.refName`, note it will be updated everytime after element changed.
 * `:refElement=${this.onRef}` - Call reference function with current element as parameter, note it will be called everytime after element changed.
 */
@defineBinding('refElement')
export class RefElementBinding implements Binding<string | ((el: Element) => void)> {

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
			this.context.refElements[value] = this.el as HTMLElement
		}
		else if (typeof value === 'function') {
			value.call(this.context, this.el)
		}
	}

	remove() {}
}
