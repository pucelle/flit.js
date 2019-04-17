import {Binding, defineBinding} from './define'
import {Component, getComponentAtElement, onComponentCreatedAt} from '../component'


/** Binding properties on component. */
defineBinding('prop', class PropBinding implements Binding {

	private el: HTMLElement
	private value: unknown = null
	private isUpdated: boolean = false

	constructor(el: Element, value: unknown) {
		if (!el.localName.includes('-')) {
			throw new Error(`":props" can't set on "<${el.localName}>", it only works on custom element`)
		}

		this.el = el as HTMLElement
		this.update(value)
	}

	update(value: unknown) {
		let com = getComponentAtElement(this.el)
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
		if (value && typeof value === 'object') {
			Object.assign(com, value)
		}
	}
})
