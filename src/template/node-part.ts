import {TemplateResult} from './template-result'
import {Part} from './types'
import {NodeAnchor} from '../internal/node-helper'
import {Template} from './template'
import {DirectiveResult, Directive, createDirectiveFromResult} from '../directives'
import {Context} from '../component'
import {trim} from '../internal/util'


enum ContentType {
	Templates,
	Directive,
	Text
}


/**
 * Related to the content betweens `<tag>${...}</tag>`, may be a template result, text, template result array, or a directive.
 */
export class NodePart implements Part {

	private anchor: NodeAnchor
	private context: Context
	private templates: Template[] | null = null
	private directive: Directive | null = null
	private textNode: Text | null = null
	private contentType: ContentType | null = null

	constructor(anchor: NodeAnchor, value: unknown, context: Context) {
		this.anchor = anchor
		this.context = context
		this.update(value)
	}

	update(value: unknown) {
		let contentType = this.getContentType(value)
		if (contentType !== this.contentType) {
			this.clearContent()
			this.contentType = contentType
		}

		switch (contentType) {
			case ContentType.Directive:
				this.updateDirective(value as DirectiveResult)
				break

			case ContentType.Templates:
				if (Array.isArray(value)) {
					this.updateTemplates(value.filter(v => v) as TemplateResult[])
				}
				else {
					this.updateTemplates([value as TemplateResult])
				}
				break

			default:
				this.updateText(value)
		}
	}

	private getContentType(value: unknown): ContentType {
		if (value instanceof DirectiveResult) {
			return ContentType.Directive
		}
		else if (value instanceof TemplateResult || Array.isArray(value)) {
			return ContentType.Templates
		}
		else {
			return ContentType.Text
		}
	}

	private clearContent() {
		let contentType = this.contentType
		if (contentType === null) {
			return
		}

		if (contentType === ContentType.Directive) {
			this.directive!.remove()
			this.directive = null
		}
		else if (contentType === ContentType.Templates) {
			for (let template of this.templates!) {
				template.remove()
			}
			this.templates = null
		}
		else if (contentType === ContentType.Text) {
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
				return
			}
			else {
				this.directive.remove()
			}
		}
		
		this.directive = createDirectiveFromResult(this.anchor, this.context as any, directiveResult)
	}
	
	// One issue when reusing old template, image will keep old appearance until the new image loaded.
	// We fix this by implementing `:src`.
	private updateTemplates(results: TemplateResult[]) {
		let templates = this.templates!
		if (!templates) {
			templates = this.templates = []
		}

		let sharedLength = Math.min(templates.length, results.length)
		if (sharedLength > 0) {
			for (let i = 0; i < sharedLength; i++) {
				let oldTemplate = templates[i]
				let result = results[i]

				if (oldTemplate.canMergeWith(result)) {
					oldTemplate.merge(result)
				}
				else {
					let newTemplate = new Template(result, this.context)
					let fragment = newTemplate.range.getFragment()

					oldTemplate.range.startNode.before(fragment)
					oldTemplate.remove()
					templates[i] = newTemplate
				}
			}
		}

		if (results.length < templates.length) {
			for (let i = templates.length - 1; i >= results.length; i--) {
				templates.pop()!.remove()
			}
		}
		else if (templates.length < results.length) {
			for (let i = templates.length; i < results.length; i++) {
				let template = new Template(results[i], this.context)
				let fragment = template.range.getFragment()

				this.anchor.insert(fragment)
				templates.push(template)
			}
		}
	}

	private updateText(value: unknown) {
		let text = value === null || value === undefined ? '' : trim(String(value))

		if (text) {
			if (this.textNode) {
				this.textNode.textContent = text
			}
			else {
				this.textNode = document.createTextNode(text)
				this.anchor.insert(this.textNode)
			}
		}
		else {
			if (this.textNode) {
				this.textNode.textContent = ''
			}
		}
	}

	remove() {
		this.clearContent()
	}
}