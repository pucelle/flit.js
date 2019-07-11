import {Binding, defineBinding} from './define'


/**
 * `:enabled="boolean"`, it's opposite to `:disabled=...`.
 * It can be replaced with `?disabled=!...`, but by the meaning it gives, we should use a direct word `enabled`.
 */
defineBinding('enable', class EnableBinding implements Binding<[any]> {

	private el: HTMLElement

	constructor(el: Element) {
		this.el = el as HTMLElement
	}

	update(value: any) {
		if (value) {
			this.el.removeAttribute('disabled')
		}
		else {
			this.el.setAttribute('disabled', '')
		}
	}

	remove() {
		this.el.removeAttribute('disabled')
	}
})


/**
 * `:disabled="boolean"`, it's same with `?disabled=...`.
 */
defineBinding('disable', class DisabledBinding implements Binding<[any]> {

	private el: HTMLElement

	constructor(el: Element) {
		this.el = el as HTMLElement
	}

	update(value: any) {
		if (value) {
			this.el.setAttribute('disabled', '')
		}
		else {
			this.el.removeAttribute('disabled')
		}
	}

	remove() {
		this.el.removeAttribute('disabled')
	}
})
