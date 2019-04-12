import {TemplateResult} from './template-result'
import {Template} from './template'
import {NodePart, PartType} from './types'
import {Component} from '../component'


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
					this.renderTemplate(value)
				}
			}
			else {
				this.template.remove()
				this.renderText(value)
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

		// If there are slot elements inside the root node,
		// the first rendering result must returns `TemplateResult`,
		// Or they will be dropped and can't restore.
		if (template.hasSlots) {
			this.context.__moveSlotsInto(fragment)
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
