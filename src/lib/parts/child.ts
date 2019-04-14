import {TemplateResult, text} from './template-result'
import {NodePart, PartType, Context} from './types'
import {Template} from './template'
import {DirectiveResult, Directive, getDirectiveConstructor} from '../directives'


enum ChildContentType {
	Templates,
	Directive,
	Text
}

export class ChildPart implements NodePart {

	type: PartType = PartType.Child

	private endNode: Comment
	private context: Context
	private templates: Template[] | null = null
	private directive: Directive | null = null
	private textNode: Text | null = null
	private contentType: ChildContentType | null = null

	constructor(endNode: Comment, value: unknown, context: Context) {
		this.context = context
		this.endNode = endNode
		this.update(value)
	}

	update(value: unknown) {
		let contentType = this.getContentType(value)
		if (contentType !== this.contentType) {
			this.clearContent()
			this.contentType = contentType
		}

		if (contentType === ChildContentType.Directive) {
			this.updateDirective(value as DirectiveResult)
		}
		else if (Array.isArray(value)) {
			this.becomeTemplateResults(value)
			this.updateTemplates(value as TemplateResult[])
		}
		else if (contentType === ChildContentType.Templates) {
			this.updateTemplates([value as TemplateResult])
		}
		else {
			this.updateText(value)
		}
	}

	private getContentType(value: unknown): ChildContentType {
		if (value instanceof DirectiveResult) {
			return ChildContentType.Directive
		}
		else if (value instanceof TemplateResult || Array.isArray(value)) {
			return ChildContentType.Templates
		}
		else {
			return ChildContentType.Text
		}
	}

	private clearContent() {
		let contentType = this.contentType
		if (contentType === null) {
			return
		}

		if (contentType === ChildContentType.Directive) {
			this.directive!.remove()
			this.directive = null
		}
		else if (contentType === ChildContentType.Templates) {
			for (let template of this.templates!) {
				template.remove()
			}
			this.templates = null
		}
		else if (contentType === ChildContentType.Text) {
			if (this.textNode) {
				this.textNode.remove()
				this.textNode = null
			}
		}
	}

	private updateDirective(directiveResult: DirectiveResult) {
		if (this.directive) {
			if (this.directive.canMergeWith(...directiveResult.args)) {
				this.directive.merge(...directiveResult.args)
			}
			else {
				this.directive.remove()
			}
		}
		
		if (!this.directive) {
			let Dir = getDirectiveConstructor(directiveResult.id)
			let directive = new Dir(this.endNode, this.context as any)
			directive.init(...directiveResult.args)
			this.directive = directive
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
	
	private updateTemplates(results: TemplateResult[]) {
		let templates = this.templates!
		if (!templates) {
			templates = this.templates = []
		}

		if (templates.length > 0 && results.length > 0) {
			for (let i = 0; i < templates.length && i < results.length; i++) {
				let oldTemplate = templates[i]
				let result = results[i]

				if (oldTemplate.canMergeWith(result)) {
					oldTemplate.merge(result)
				}
				else {
					let newTemplate = new Template(result, this.context)
					let fragment = newTemplate.getFragment()

					oldTemplate.startNode!.before(fragment)
					oldTemplate.remove()
					templates[i] = newTemplate
				}
			}
		}

		if (results.length < templates.length) {
			for (let i = results.length; i < templates.length; i++) {
				let template = templates[i]
				template.remove()
			}
			this.templates = templates.slice(0, results.length)
		}

		else if (templates.length < results.length) {
			for (let i = templates.length; i < results.length; i++) {
				let template = new Template(results[i], this.context)
				let fragment = template.getFragment()

				this.endNode.before(fragment)
				templates.push(template)
			}
		}
	}

	private updateText(value: unknown) {
		let text = value === null || value === undefined ? '' : String(value).trim()

		if (text) {
			if (this.textNode) {
				this.textNode.textContent = text
			}
			else {
				this.textNode = document.createTextNode(text)
				this.endNode.before(this.textNode)
			}
		}
		else {
			if (this.textNode) {
				this.textNode.textContent = ''
			}
		}
	}
}