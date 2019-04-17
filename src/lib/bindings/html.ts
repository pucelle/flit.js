import {Binding, defineBinding} from './define'


/**
 * `:html="${HTMLCodes}"`
 */
defineBinding('html', class HTMLBinding implements Binding {

	private el: HTMLElement

	constructor(el: Element, value: unknown) {
		this.el = el as HTMLElement
		this.update(value)
	}

	update(value: unknown) {
		this.el.innerHTML = value === null || value === undefined ? '' : String(value)
	}
})
