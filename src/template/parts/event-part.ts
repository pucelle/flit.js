import {getComponentEarly, Context} from '../../component'
import {on} from '../../internals/dom-event'


/**
 * Registers a document or component event.
 * 
 * `<div @click=${...}>` to register an element event.
 * `<com @@event=${...}>` to register a component event.
 */
export class EventPart implements Part {

	private readonly el: Element
	private readonly name: string
	private readonly context: Context
	private readonly isComEvent: boolean

	private handler!: (...args: any[]) => void

	constructor(el: Element, name: string, handler: (...args: any[]) => void, context: Context) {
		this.el = el
		this.name = name[0] === '@' ? name.slice(1) : name
		this.context = context
		this.isComEvent = el.localName.includes('-') && name[0] === '@'

		this.bindListener()
		this.update(handler)
	}

	private bindListener() {
		if (this.isComEvent) {
			getComponentEarly(this.el as HTMLElement, com => {
				com!.on(this.name, this.triggerHandler, this)
			})
		}
		else {
			on(this.el, this.name, this.triggerHandler, this)
		}
	}

	update(handler: (...args: any[]) => void) {
		// Must be a function handler, can't set as `null` to disable event.
		if (typeof handler !== 'function') {
			throw new Error(`Failed to register listener at "<${this.el.localName} @${this.name}='${handler}'">, listener is not a function!`)
		}

		// Doesn't update registered handler dynamically because here it may be updated frequently.
		this.handler = handler
	}

	private triggerHandler(...args: any[]) {
		// Event will be triggered with current context as scope.
		this.handler.call(this.context, ...args)
	}
}