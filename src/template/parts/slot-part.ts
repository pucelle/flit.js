import type {Component, Context} from '../../component'
import {Part} from './types'


/** 
 * To fill slot tag with slot contents.
 * `<slot>`
 * `<slot name="...">`
 */
export class SlotPart implements Part {

	private readonly el: Element
	private readonly name: string | null
	private readonly context: Component

	constructor(el: Element, name: string | null, context: Context) {
		if (!context) {
			throw new ReferenceError(`A context must be provided when using "<slot>"!`)
		}

		this.el = el
		this.name = name
		this.context = context
	}

	update() {
		if (this.name) {
			if (this.context.slots.hasOwnProperty(this.name)) {
				this.el.append(...this.context.slots[this.name])
			}
		}
		else {

			// Why not just append child nodes?
			// Because the `<slot>` may be created dynamically:
			//   booleanValue ? html`<div class="class1"><slot /></div>` : html`<div class="class2"><slot /></div>`
			this.el.append(this.context.__restNodeRange.extractToFragment())
		}
	}
}