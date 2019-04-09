import {Binding, defineBinding} from './define'


/**
 * `:html="${HTMLCodes}"`
 */
defineBinding('html', class HTMLBinding implements Binding {

	private el: HTMLElement

	constructor(el: HTMLElement, value: unknown) {
		this.el = el
		this.update(value)
	}

	update(value: unknown) {
		this.el.innerHTML = value === null || value === undefined ? '' : String(value)
	}
})
