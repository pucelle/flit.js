import {Part, PartType} from "./shared"
import {Component, getComponentAtElement, onComponentCreatedAt, Context} from '../component'
import {on, off} from "../dom-event"


/**
 * <component-name @@com-event="${this.onComEvent}">
 * <div @click="${this.onClick}">
 */
export class EventPart implements Part {

	type: PartType = PartType.Event

	private el: Element
	private name: string
	private handler!: Function
	private context: NonNullable<Context>
	private isComEvent: boolean
	private isUpdated: boolean = false

	constructor(el: Element, name: string, handler: Function, context: Context) {
		if (!context) {
			throw new Error(`A context must be provided when registering event "${name}"`)
		}

		this.el = el
		this.name = name[0] === '@' ? name.slice(1) : name
		this.context = context
		this.isComEvent = el.localName.includes('-') && name[0] === '@'
		this.setHandler(handler)
	}

	private setHandler(newHandler: Function) {
		let oldHandler = this.handler
		this.handler = newHandler

		if (this.isComEvent) {
			let com = getComponentAtElement(this.el as HTMLElement)
			if (com) {
				if (oldHandler) {
					com.off(this.name, oldHandler, this.context)
				}
				this.setComHandler(com)
			}
			else if (!this.isUpdated) {
				onComponentCreatedAt(this.el as HTMLElement, this.setComHandler.bind(this))
			}
		}
		else {
			if (oldHandler) {
				off(this.el, this.name, oldHandler as (e: Event) => void, this.context)
			}

			on(this.el, this.name, newHandler as (e: Event) => void, this.context)
		}
	}

	setComHandler(com: Component) {
		com.on(this.name, this.handler, this.context)
	}

	update(handler: Function) {
		if (typeof handler !== 'function') {
			throw new Error(`Failed to register listener at "<${this.el.localName} @${this.name}='${handler}'">, the listener is not a function`)
		}

		this.setHandler(handler)
		this.isUpdated = true
	}

	// If element was removed, it implies that the component was removed too.
	// No need to off listener.
	remove() {}
}