import {Component, Context, getClosestComponentEarly} from '../component'
import {Binding, defineBinding} from './define'


/**
 * Insert current element into closest component at mapped `<slot>` position,
 * and also reference current element as a `slots` property.
 * 
 * `:slot="slotName"` - Insert into the position specified by `<slot name="slotName">`.
 */
@defineBinding('slot')
export class SlotBinding implements Binding<string> {

	private readonly el: Element
	private readonly context: Context
	
	constructor(el: Element, context: Context) {
		this.el = el
		this.context = context
	}

	update(slotName: string) {
		// Prepared `slots` properties before trigger `created` event.
		getClosestComponentEarly(this.el, com => {
			// When extend super component and provide `:slot`, use current context as slot context.
			com = com || this.context

			if (com) {
				this.updateComSlot(slotName, com!)
			}
		})
	}

	updateComSlot(slotName: string, com: Component) {
		if (!com.slots[slotName]) {
			com.slots[slotName] = []
		}

		com.slots[slotName].push(this.el)
	}

	remove() {}
}
