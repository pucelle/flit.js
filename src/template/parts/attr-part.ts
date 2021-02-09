/** 
 * To set attribute value.
 * `attr=${...}`
 */
export class AttrPart implements Part {

	private readonly el: Element
	private readonly name: string

	constructor(el: Element, name: string, value: any) {
		this.el = el
		this.name = name
		this.update(value)
	}

	update(value: any) {
		this.setValue(value)
	}
	
	private setValue(value: any) {
		value = value === null || value === undefined ? '' : String(value)
		this.el.setAttribute(this.name, value)
	}
}