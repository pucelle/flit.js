import {TemplateResult} from '../template-result'
import {Template} from './template'
import {Component} from '../component'
import {NodePart, PartType} from './types'


export class RootPart implements NodePart {

	type = PartType.Root

	private el: HTMLElement
	private context: Component
	private template: Template | null = null

	constructor(el: HTMLElement, value: unknown, context: Component) {
		this.el = el
		this.context = context
		this.update(value)
	}

	update(value: unknown) {
		if (this.template) {
			if (value instanceof TemplateResult) {
				if (this.template.canMergeWith(value)) {
					this.template.merge(value)
				}
				else {
					this.template.remove()
					this.createTemplateAndRender(value)
				}
			}
		}
		else {
			if (value instanceof TemplateResult) {
				this.createTemplateAndRender(value)
			}
			else {
				this.renderText(value)
			}
		}
	}

	private createTemplateAndRender(result: TemplateResult) {
		this.template = new Template(result, this.context)
		this.renderFragment(this.template.parse())
	}

	private renderFragment(fragment: DocumentFragment) {
		while (this.el.firstChild) {
			this.el.firstChild.remove()
		}

		this.el.append(fragment)
	}

	private renderText(value: unknown) {
		let text = value === null || value === undefined ? '' : String(value).trim()
		this.el.textContent = text
	}
}
