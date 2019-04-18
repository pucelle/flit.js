import {Binding, defineBinding} from './define'
import {Component, getComponentAtElement, cachePropsAtElement} from '../component'


/** Binding properties on component. */
defineBinding('prop', class PropBinding implements Binding {

	private el: HTMLElement
	private com: Component | undefined

	constructor(el: Element, value: unknown) {
		if (!el.localName.includes('-')) {
			throw new Error(`":props" can't set on "<${el.localName}>", it only works on custom element`)
		}

		this.el = el as HTMLElement
		this.com = getComponentAtElement(el as HTMLElement)
		this.update(value)
	}

	update(value: unknown) {
		if (value && typeof value === 'object') {
			if (this.com) {
				Object.assign(this.com, value)
			}
			else if (value){
				cachePropsAtElement(this.el, value)
			}
		}
	}
})
