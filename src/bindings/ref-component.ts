import {Component, Context, getComponentEarly} from '../component'
import {Binding, defineBinding} from './define'


/**
 * To reference current element as a `refs` property or captures and passes to a handler.
 * 
 * `:refComponent="name"`- Reference as a property in current component at `.refs.refName`, note it will be updated everytime after element changed.
 * `:refComponent=${this.onRef}` - Call reference function with the component as parameter, note it will be called everytime after element changed.
 */
@defineBinding('refComponent')
export class RefComponentBinding implements Binding<string | ((el: Component) => void)> {

	private readonly el: Element
	private readonly context: Component

	constructor(el: Element, context: Context) {
		if (!context) {
			throw new ReferenceError(`A context must be provided when using ":ref" binding!`)
		}

		this.el = el
		this.context = context
	}

	update(value: string | ((com: Component) => void)) {
		getComponentEarly(this.el as HTMLElement, (com: Component | null) => {
			if (com) {
				if (typeof value === 'string') {
					(this.context as any)[value] = com
				}
				else if (typeof value === 'function') {
					value.call(this.context, com)
				}
			}
		})
	}

	remove() {}
}
