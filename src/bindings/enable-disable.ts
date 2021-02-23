import {Binding, defineBinding} from './define'


/**
 * `:enable` binding will set `disabled` state for element if it's binded value is `false`.
 * 
 * `:enable=${booleanValue}`
 */
@defineBinding('enable')
export class EnableBinding implements Binding<any> {

	private readonly el: HTMLElement

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
}


/**
 * `:disable` binding will set `disabled` state for element if it's binded value is `true`.
 * 
 * `:disable=${booleanValue}`
 */
@defineBinding('disable')
export class DisabledBinding implements Binding<any> {

	private readonly el: HTMLElement

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
}
