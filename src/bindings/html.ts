import {Binding, defineBinding} from './define'


/**
 * `:html` binding will update html content for element.
 * 
 * `:html=${InnerHTMLCodes}`
 */
@defineBinding('html')
export class HTMLBinding implements Binding<string> {

	private readonly el: HTMLElement

	constructor(el: Element) {
		this.el = el as HTMLElement
	}

	update(value: string) {
		this.el.innerHTML = value === null || value === undefined ? '' : String(value)
	}

	remove() {
		this.el.innerHTML = ''
	}
}
