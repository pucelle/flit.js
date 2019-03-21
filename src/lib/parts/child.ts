import {TemplateResult, text} from '../template-result'
import {Component} from '../component'
import {NodePart, PartType} from './types'
import {Template} from './template'


export class ChildPart implements NodePart {

	type: PartType = PartType.Child

	private comment: Comment
	private context: Component
	private templates: Template[] | null = null
	private textNode: Text | null = null

	constructor(comment: Comment, value: unknown, context: Component) {
		this.context = context
		this.comment = comment
		this.update(value)
	}

	update(value: unknown) {
		if (Array.isArray(value)) {
			this.becomeTemplateResults(value)
		}
		else if (value instanceof TemplateResult) {
			value = [value]	
		}

		if (this.templates) {
			if (Array.isArray(value)) {
				this.mergeTemplates(value)
			}
			else {
				for (let template of this.templates) {
					template.remove()
				}
				this.templates = null
				this.renderText(value)
			}
		}
		else {
			if (Array.isArray(value)) {
				this.restoreComment()
				this.templates = []
				this.mergeTemplates(value)
			}
			else {
				this.renderText(value)
			}
		}
	}

	private becomeTemplateResults(array: unknown[]): TemplateResult[] {
		for (let i = 0; i < array.length; i++) {
			if (!(array[i] instanceof TemplateResult)) {
				array[i] = text`${array[i]}`
			}
		}

		return array as TemplateResult[]
	}

	private mergeTemplates(results: TemplateResult[]) {
		let templates = this.templates!

		if (templates.length > 0 && results.length > 0) {
			for (let i = 0; i < templates.length && i < results.length; i++) {
				let template = templates[i]
				let result = results[i]

				if (template.canMergeWith(result)) {
					template.merge(result)
				}
				else {
					let newTemplate = new Template(result, this.context)
					template.replaceWithFragment(newTemplate.parseMayTrack(true))
					templates[i] = newTemplate
				}
			}
		}

		if (results.length < templates.length) {
			for (let i = results.length; i < templates.length; i++) {
				let template = templates[i]
				template.remove()
			}
		}

		else if (templates.length < results.length) {
			for (let i = templates.length; i < results.length; i++) {
				let template = new Template(results[i], this.context)
				this.renderFragment(template.parseMayTrack(true))
				this.templates!.push(template)
			}
		}
	}

	private renderFragment(fragment: DocumentFragment) {
		this.comment.before(fragment)
	}

	private renderText(value: unknown) {
		let text = value === null || value === undefined ? '' : String(value).trim()

		if (text) {
			if (!this.textNode) {
				this.textNode = document.createTextNode(text)
				this.comment.replaceWith(this.textNode)
			}
			else {
				this.textNode.textContent = text
				if (!this.textNode.parentNode) {
					this.comment.replaceWith(this.textNode)
				}
			}
		}
		else {
			if (this.textNode) {
				this.textNode.textContent = ''
			}
		}
	}

	private restoreComment() {
		if (this.textNode && this.textNode.parentNode) {
			this.textNode.replaceWith(this.comment)
		}
	}

	remove() {
		if (this.templates) {
			this.templates.forEach(template => template.remove())
		}

		if (this.comment && this.comment.parentNode) {
			this.comment.remove()
		}

		if (this.textNode && this.textNode.parentNode) {
			this.textNode.remove()
		}
	}
}