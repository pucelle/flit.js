import {Component, get} from '../component'
import {Part, PartType} from './shared'


const deferredEventPartsMap: WeakMap<HTMLElement, EventPart[]> = new WeakMap()

export function tryBindDeferredEvents(el: HTMLElement) {
	let parts = deferredEventPartsMap.get(el)
	if (parts) {
		for (let part of parts) {
			part.bindDeferred()
		}
		deferredEventPartsMap.delete(el)
	}
}

function addDeferredEventParts(el: HTMLElement, part: EventPart) {
	let parts = deferredEventPartsMap.get(el)
	if (!parts) {
		deferredEventPartsMap.set(el, (parts = []))
	}
	parts.push(part)
}


export class EventPart implements Part {
	type = PartType.Event
	width = 1
	private el: HTMLElement
	private name: string
	private handler!: Function
	private context: Component
	private isComEvent: boolean

	constructor(el: HTMLElement, name: string, handler: Function, context: Component) {
		this.el = el
		this.name = name[0] === '@' ? name.slice(1) : name
		this.context = context
		this.isComEvent = el.localName.includes('-') && name[0] !== '@'
		this.setHandler(handler)
	}

	private setHandler(newHandler: Function) {
		let oldHandler = this.handler

		if (this.isComEvent) {
			let com = get(this.el)
			if (com) {
				if (oldHandler) {
					com.off(this.name, oldHandler, this.context)
				}
				com.on(this.name, newHandler, this.context)
			}
			else if (!oldHandler) {
				addDeferredEventParts(this.el, this)
			}
		}
		else {
			//TO DO
			if (!oldHandler) {
				this.el.removeEventListener(this.name, oldHandler)
			}

			this.el.addEventListener(this.name, newHandler.bind(this.context))
		}

		this.handler = newHandler
	}

	bindDeferred() {
		let com = get(this.el)
		if (com) {
			com.on(this.name, this.handler, com)
		}
	}

	merge(handler: Function) {
		this.setHandler(handler)
	}
}