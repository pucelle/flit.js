import {Binding, defineBinding} from './define'
import {Component, getComponentAtElement, onComponentCreatedAt} from '../component'


/** Binding properties on component. */
defineBinding('prop', class PropBinding implements Binding {

	private el: HTMLElement
	private property: string | null
	private value: unknown = null
	private isUpdated: boolean = false

	constructor(el: HTMLElement, value: unknown, modifiers: string[] | null) {
		if (!el.localName.includes('-')) {
			throw new Error(`":prop${modifiers ? modifiers.map(m => '.' + m) : ''}" can't set on <${el.localName}>, it only works on custom element`)
		}

		if (modifiers) {
			if (modifiers.length > 1) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most one modifier as property name can be specified for ":prop"`)
			}

			if (!/^[\w]+$/.test(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid property name`)
			}
		}

		this.el = el
		this.property = modifiers ? modifiers[0] : null
		this.update(value)
	}

	update(value: unknown) {
		let com = getComponentAtElement(this.el)
		if (com) {
			this.setProp(com, value)
		}
		else {
			this.value = value

			if (!this.isUpdated) {
				onComponentCreatedAt(this.el, this.setPropLater.bind(this))
			}
		}

		this.isUpdated = true
	}

	setPropLater(com: Component) {
		this.setProp(com, this.value)
		this.value = null
	}

	setProp(com: Component, value: unknown) {
		if (this.property) {
			(com as any)[this.property] = value
		}
		else {
			if (typeof value === 'object') {
				Object.assign(com, value)
			}
		}
	}
})
