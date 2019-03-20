import {Component, getComponentAt, onComponentCreatedAt} from '../component'
import {Part, PartType} from "./types"


export class EventPart implements Part {

	type: PartType = PartType.Event
	width: number = 1
	strings: string[] | null = null

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
			let com = getComponentAt(this.el)
			if (com) {
				if (oldHandler) {
					com.off(this.name, oldHandler, this.context)
				}
				com.on(this.name, newHandler, this.context)
			}
			else if (!oldHandler) {
				onComponentCreatedAt(this.el, this.setHandlerLater.bind(this))
			}
		}
		else {
			//TO DO
			// if (oldHandler) {
			// 	this.el.removeEventListener(this.name, oldHandler as Function)
			// }

			this.el.addEventListener(this.name, newHandler.bind(this.context))
		}

		this.handler = newHandler
	}

	setHandlerLater(com: Component) {
		com.on(this.name, this.handler, com)
	}

	update(handler: Function) {
		this.setHandler(handler)
	}
}