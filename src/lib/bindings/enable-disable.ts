import {Binding, defineBinding} from './define'


/**
 * `:enabled="boolean"`, it's opposite to `:disabled=...`.
 * It can be replaced with `?disabled=!...`, but by the meaning it gives, we should use a direct word `enabled`.
 */
defineBinding('enabled', class EnableBinding implements Binding {

	private el: HTMLElement

	constructor(el: Element, value: unknown) {
		this.el = el as HTMLElement
		this.update(value as boolean)
	}

	update(value: boolean) {
		if (value) {
			this.el.removeAttribute('disabled')
		}
		else {
			this.el.setAttribute('disabled', '')
		}
	}
})


/**
 * `:disabled="boolean"`, it's same with `?disabled=...`.
 */
defineBinding('disabled', class DisabledBinding implements Binding {

	private el: HTMLElement

	constructor(el: Element, value: unknown) {
		this.el = el as HTMLElement
		this.update(value as boolean)
	}

	update(value: boolean) {
		if (value) {
			this.el.setAttribute('disabled', '')
		}
		else {
			this.el.removeAttribute('disabled')
		}
	}
})
