import {Binding, defineBinding} from './define'
import {Component, getComponent, onComponentCreatedAt} from '../component'


/** Binding properties on component. */
defineBinding('prop', class PropBinding implements Binding {

	private property: string
	private com: Component | undefined
	private value: unknown = undefined

	constructor(el: Element, value: unknown, modifiers: string[] | null) {
		if (!modifiers) {
			throw new Error(`":prop" binding requires a modifier like ":prop.name"`)
		}

		if (modifiers.length > 1) {
			throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most one modifier as property name can be specified for ":prop"`)
		}

		if (!/^[\w]+$/.test(modifiers[0])) {
			throw new Error(`Modifier "${modifiers[0]}" is not a valid property name`)
		}

		if (!el.localName.includes('-')) {
			throw new Error(`":prop.${modifiers[0]}" can't set on "<${el.localName}>", it only works on custom element`)
		}

		this.property = modifiers[0]

		let com = getComponent(el as HTMLElement)
		if (com) {
			this.com = com
		}
		else {
			onComponentCreatedAt(el as HTMLElement, this.onComCreated.bind(this))
		}

		this.update(value)
	}

	onComCreated(com: Component) {
		this.com = com
		this.updateValue(this.value)
		this.value = undefined	
	}

	update(value: unknown) {
		if (this.com) {
			this.updateValue(value)
		}
		else {
			this.value = value
		}
	}

	updateValue(value: unknown) {
		// We didn't compare values in component value setting to trigger update,
		// Such that here compare it will avoid unnecessary updating.
		let com = this.com as any
		if (com[this.property] !== value) {
			com[this.property] = value
		}
	}
})
