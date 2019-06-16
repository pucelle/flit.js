import {Binding, defineBinding} from './define'


/**
 * `:html="${HTMLCodes}"`
 */
defineBinding('html', class HTMLBinding implements Binding<[string]> {

	private el: HTMLElement

	constructor(el: Element) {
		this.el = el as HTMLElement
	}

	update(value: string) {
		this.el.innerHTML = value === null || value === undefined ? '' : String(value)
	}

	remove() {
		this.el.innerHTML = ''
	}
})
