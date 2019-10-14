import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../template'
import {text} from '../template'
import {Context} from '../component'
import {NodeAnchorType, NodeAnchor} from "../libs/node-helper"
import {DirectiveTransition, DirectiveTransitionOptions} from './directive-transition'


class CacheDirective implements Directive {

	private anchor: NodeAnchor
	private context: Context
	private transition: DirectiveTransition
	private templates: Template[] = []
	private currentTemplate: Template | null = null

	constructor(anchor: NodeAnchor, context: Context) {
		this.anchor = anchor
		this.context = context
		this.transition = new DirectiveTransition(context)
	}

	private async playEnterTransition(template: Template) {
		let firstElement = template.range.getFirstElement()
		if (firstElement) {
			await this.transition.mayPlayEnter(firstElement)
		}
	}

	canMergeWith(_result: TemplateResult | string | null): boolean {
		return true
	}

	merge(result: TemplateResult | string | null, options?: DirectiveTransitionOptions) {
		this.transition.setOptions(options)

		if (result) {
			if (typeof result === 'string') {
				result = text`${result}`
			}

			if (this.currentTemplate && this.currentTemplate.canMergeWith(result)) {
				this.currentTemplate.merge(result)
			}
			else {
				if (this.currentTemplate) {
					this.cacheCurrentTemplate()
				}

				let template = this.templates.find(t => t.canMergeWith(result as TemplateResult))
				if (template) {
					template.merge(result)
					this.anchor.insert(template.range.getFragment())
					this.playEnterTransition(template)
					this.currentTemplate = template
				}
				else {
					this.initTrueResult(result)
				}
			}
		}
		else {
			if (this.currentTemplate) {
				this.cacheCurrentTemplate()
			}
		}
	}
	
	private initTrueResult(result: TemplateResult | string) {
		if (typeof result === 'string') {
			result = text`${result}`
		}
		
		let atStart = this.templates.length === 0
		let template = new Template(result, this.context)
		let fragment = template.range.getFragment()
		this.anchor.insert(fragment)

		if (this.transition.shouldPlayEnter(atStart)) {
			this.playEnterTransition(template)
		}

		this.currentTemplate = template
		this.templates.push(template)
	}

	private async cacheCurrentTemplate() {
		let template = this.currentTemplate!
		let firstElement = template.range.getFirstElement()

		// Cached elements have been moved, reset the anchor node to current parent node.
		if (this.anchor.type === NodeAnchorType.Next && firstElement && firstElement.parentNode && firstElement.parentNode !== this.anchor.el.parentNode) {
			this.anchor = new NodeAnchor(firstElement.parentNode, NodeAnchorType.Parent)
		}

		if (this.transition.shouldPlay() && firstElement) {
			this.transition.mayPlayLeave(firstElement).then((finish: boolean) => {
				if (finish) {
					template.range.cacheFragment()
				}
			})
		}
		else {
			template.range.cacheFragment()
		}

		this.currentTemplate = null
	}

	remove() {
		if (this.currentTemplate) {
			this.currentTemplate.remove()
		}
	}
}

/**
 * When returned vlaue of `result` changed, this directive will try to reuse old rendered elements.
 * Note that when old rendering result restored, the scroll positions in it will fall back to start position.
 * @param result The html`...` result, can be null or empty string. This value map change when rerendering.
 */
export const cache = defineDirective(CacheDirective) as (result: TemplateResult | string | null, options?: DirectiveTransitionOptions) => DirectiveResult
