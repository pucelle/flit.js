import {NodePart, PartType, Context} from "./types"
import {Component, getComponentAtElement, onComponentCreatedAt} from '../component'
import {on, off} from "../dom-event"


/**
 * <component-name @com-event="${this.onComEvent}" @@click="${this.onClick}">
 * <div @click="${this.onClick}">
 */
export class EventPart implements NodePart {

	type: PartType = PartType.Event

	private el: HTMLElement
	private name: string
	private handler!: Function
	private context: Context
	private isComEvent: boolean
	private isUpdated: boolean = false

	constructor(el: HTMLElement, name: string, handler: Function, context: Context) {
		this.el = el
		this.name = name[0] === '@' ? name.slice(1) : name
		this.context = context
		this.isComEvent = el.localName.includes('-') && name[0] !== '@'
		this.setHandler(handler)
	}

	private setHandler(newHandler: Function) {
		let oldHandler = this.handler

		if (this.isComEvent) {
			let com = getComponentAtElement(this.el)
			if (com) {
				if (oldHandler) {
					com.off(this.name, oldHandler, this.context)
				}
				com.on(this.name, newHandler, this.context)
			}
			else if (!this.isUpdated) {
				onComponentCreatedAt(this.el, this.setComHandlerLater.bind(this))
			}
		}
		else {
			if (oldHandler) {
				off(this.el, this.name, oldHandler as (e: Event) => void, this.context)
			}

			on(this.el, this.name, newHandler as (e: Event) => void, this.context)
		}

		this.handler = newHandler
	}

	setComHandlerLater(com: Component) {
		com.on(this.name, this.handler, com)
	}

	update(handler: Function) {
		if (typeof handler !== 'function') {
			throw new Error(`Failed to register listener at "<${this.el.localName} @${this.name}='${handler}'">, the listener is not a function`)
		}

		this.setHandler(handler)
		this.isUpdated = true
	}
}