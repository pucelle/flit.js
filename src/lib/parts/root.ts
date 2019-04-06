import {TemplateResult} from './template-result'
import {Template} from './template'
import {NodePart, PartType, Context} from './types'


export class RootPart implements NodePart {

	type = PartType.Root

	private el: HTMLElement
	private context: Context
	private template: Template | null = null
	private slotMap: Map<string, HTMLElement[]> | null = null
	private restNodes: Node[] | null = null

	constructor(el: HTMLElement, value: unknown, context: Context) {
		this.el = el
		this.context = context
		this.cacheChildNodes()
		this.update(value)
	}

	private cacheChildNodes() {
		if (this.el.childNodes.length) {
			let fragment = document.createDocumentFragment()
			fragment.append(...this.el.childNodes)
			this.slotMap = new Map()

			for (let el of fragment.querySelectorAll('[slot]')) {
				let slotName = el.getAttribute('slot')!
				let els = this.slotMap.get(slotName)
				if (!els) {
					this.slotMap.set(slotName, els = [])
				}
				els.push(el as HTMLElement)
				el.remove()
			}

			if (fragment.childNodes.length > 0) {
				this.restNodes = [...fragment.childNodes]
			}
		}
	}

	update(value: unknown) {
		if (this.template) {
			if (value instanceof TemplateResult) {
				if (this.template.canMergeWith(value)) {
					this.template.merge(value)
				}
				else {
					this.template.remove()
					this.renderTemplate(value)
				}
			}
		}
		else {
			if (value instanceof TemplateResult) {
				this.renderTemplate(value)
			}
			else {
				this.renderText(value)
			}
		}
	}

	private renderTemplate(result: TemplateResult) {
		let template = new Template(result, this.context)
		let fragment = template.getFragment()

		if (template.hasSlots) {
			let slots = fragment.querySelectorAll('slot')

			for (let slot of slots) {
				let slotName = slot.getAttribute('name')
				if (slotName) {
					if (this.slotMap && this.slotMap.has(slotName)) {
						while (slot.firstChild) {
							slot.firstChild.remove()
						}
						slot.append(...this.slotMap.get(slotName)!)
					}
				}
				else if (this.restNodes) {
					while (slot.firstChild) {
						slot.firstChild.remove()
					}
					slot.append(...this.restNodes)
				}
			}
		}

		while (this.el.firstChild) {
			this.el.firstChild.remove()
		}

		this.el.append(fragment)
		this.template = template
	}

	private renderText(value: unknown) {
		let text = value === null || value === undefined ? '' : String(value).trim()
		this.el.textContent = text
	}
}
