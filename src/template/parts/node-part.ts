import {TemplateResult} from '../template-result'
import {NodeAnchor} from "../../internals/node-anchor"
import {Template} from '../template'
import {DirectiveResult, Directive, DirectiveReferences} from '../../directives'
import type {Context} from '../../component'
import {trim} from '../../helpers/utils'
import {Part} from './types'


/** Contents that can be included in a `<tag>${...}<.tag>`. */
enum ContentType {
	Template,
	TemplateArray,
	Directive,
	Text,
}


/**
 * Associated with the contents betweens `<tag>${...}</tag>`.
 * May be a template result, text, template result array, or a directive.
 */
export class NodePart implements Part {

	private readonly anchor: NodeAnchor
	private readonly context: Context
	
	private contentType: ContentType | null = null
	private content: Template | Template[] | Directive | Text | null = null

	constructor(anchor: NodeAnchor, context: Context) {
		this.anchor = anchor
		this.context = context
	}

	update(value: unknown) {
		let newContentType = this.getNewContentType(value)

		if (newContentType !== this.contentType && this.contentType !== null) {
			this.clearOldContent()
		}

		this.contentType = newContentType

		switch (newContentType) {
			case ContentType.Template:
				this.updateTemplate(value as TemplateResult)
				break

			case ContentType.Directive:
				this.updateDirective(value as DirectiveResult)
				break
			
			case ContentType.TemplateArray:
				this.updateTemplateArray(value as TemplateResult[])
				break

			case ContentType.Text:
				this.updateText(value)
		}
	}

	private getNewContentType(value: unknown): ContentType {
		if (value instanceof TemplateResult) {
			return ContentType.Template
		}
		else if (value instanceof DirectiveResult) {
			return ContentType.Directive
		}
		else if (Array.isArray(value)) {
			return ContentType.TemplateArray
		}
		else {
			return ContentType.Text
		}
	}

	private clearOldContent() {
		let contentType = this.contentType

		if (contentType === ContentType.Template) {
			(this.content as Template).remove()
		}
		else if (contentType === ContentType.Directive) {
			(this.content as Directive).remove()
			DirectiveReferences.removeReference((this.content as Directive))
		}
		else if (contentType === ContentType.TemplateArray) {
			for (let template of this.content as Template[]) {
				template.remove()
			}
		}
		else if (contentType === ContentType.Text) {
			if (this.content) {
				(this.content as Text).remove()
			}
		}

		this.content = null
	}
	
	private updateTemplate(result: TemplateResult) {

		// One issue when reusing old template - image will keep old appearance until the new image loaded.
		// We can partly fix this by implementing a binding API `:src`.

		let oldTemplate = this.content as Template | null
		if (oldTemplate && oldTemplate.canPatchBy(result)) {
			oldTemplate.patch(result)
		}
		else {
			if (oldTemplate) {
				oldTemplate.remove()
			}

			let newTemplate = new Template(result, this.context)
			this.anchor.insert(newTemplate.extractToFragment())
			this.content = newTemplate
		}
	}

	private updateDirective(result: DirectiveResult) {
		let oldDirective = this.content as Directive | null

		if (oldDirective && oldDirective.canPatchBy(...result.args)) {
			oldDirective.patch(...result.args)
		}
		else {
			if (oldDirective) {
				oldDirective.remove()
			}

			this.content = DirectiveReferences.createFromResult(this.anchor, this.context, result)
		}
	}
	
	private updateTemplateArray(results: TemplateResult[]) {
		let templates = this.content as Template[] | null
		if (!templates) {
			templates = this.content = []
		}

		results = results.filter(result => result instanceof TemplateResult)

		// Updates shared part.
		for (let i = 0; i < Math.min(templates.length, results.length); i++) {
			let oldTemplate = templates[i]
			let result = results[i]

			if (oldTemplate.canPatchBy(result)) {
				oldTemplate.patch(result)
			}
			else {
				let newTemplate = new Template(result, this.context)
				oldTemplate.replaceWith(newTemplate)
				templates[i] = newTemplate
			}
		}

		// Removes rest.
		if (results.length < templates.length) {
			for (let i = templates.length - 1; i >= results.length; i--) {
				templates.pop()!.remove()
			}
		}

		// Creates more.
		else {
			for (let i = templates.length; i < results.length; i++) {
				let result = results[i]
				let template = new Template(result, this.context)
				this.anchor.insert(template.extractToFragment())
				templates.push(template)
			}
		}
	}

	private updateText(value: unknown) {
		let textNode = this.content as Text | null
		let text = value === null || value === undefined ? '' : trim(String(value))

		if (text) {
			if (textNode) {
				textNode.textContent = text
			}
			else {
				textNode = document.createTextNode(text)
				this.anchor.insert(textNode)
				this.content = textNode
			}
		}
		else {
			if (textNode) {
				textNode.textContent = ''
			}
		}
	}
}