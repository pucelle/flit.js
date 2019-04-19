import {Binding, defineBinding} from './define'
import {Component, getComponent, onComponentCreatedAt} from '../component'


/** Binding properties on component. */
defineBinding('prop', class PropBinding implements Binding {

	private com: Component | undefined
	private value: unknown = undefined

	constructor(el: Element, value: unknown) {
		if (!el.localName.includes('-')) {
			throw new Error(`":props" can't set on "<${el.localName}>", it only works on custom element`)
		}

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
		else if (value){
			this.value = value
		}
	}

	updateValue(value: unknown) {
		if (value && typeof value === 'object') {
			Object.assign(this.com, value)
		}
	}
})
