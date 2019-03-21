import {Binding, defineBinding} from './define'
import {Component, getComponentAt, onComponentCreatedAt} from '../component'


/**
 * 
 */
defineBinding('props', class PropsBinding implements Binding {

	private el: HTMLElement
	private property: string | null
	private value: unknown = null
	private isUpdated: boolean = false

	constructor(el: HTMLElement, value: unknown, modifiers: string[] | null) {
		if (!el.localName.includes('-')) {
			throw new Error(`":props${modifiers ? modifiers.map(m => '.' + m) : ''}" can't set on <${el.localName}>, it only works on custom element`)
		}

		if (modifiers) {
			if (modifiers.length > 1) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most one modifier can be specified for ":props"`)
			}

			if (!/^[\w]+$/.test(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid props name`)
			}
		}

		this.el = el
		this.property = modifiers ? modifiers[0] : null
		this.update(value)
	}

	update(value: unknown) {
		let com = getComponentAt(this.el)
		if (com) {
			this.setProps(com, value)
		}
		else {
			this.value = value

			if (!this.isUpdated) {
				onComponentCreatedAt(this.el, this.setPropsLater.bind(this))
			}
		}

		this.isUpdated = true
	}

	setPropsLater(com: Component) {
		this.setProps(com, this.value)
		this.value = null
	}

	setProps(com: Component, value: unknown) {
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
