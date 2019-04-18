import {Binding, defineBinding} from './define'
import {Component, getComponentAtElement, cachePropAtElement} from '../component'


/** Binding properties on component. */
defineBinding('prop', class PropBinding implements Binding {

	private el: HTMLElement
	private property: string
	private com: Component | undefined

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

		this.el = el as HTMLElement
		this.property = modifiers[0]
		this.com = getComponentAtElement(el as HTMLElement)
		this.update(value)
	}

	update(value: unknown) {
		if (this.com) {
			(this.com as any)[this.property] = value
		}
		else {
			cachePropAtElement(this.el, this.property, value)
		}
	}
})
