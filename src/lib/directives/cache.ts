import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../parts'
import {text} from '../parts/template-result'
import {Context} from '../component'
import {NodeAnchorType, NodeAnchor} from "../node-helper"
import {DirectiveTransition, DirectiveTransitionOptions} from './shared'


class CacheDirective implements Directive {

	private anchorNode: NodeAnchor
	private context: Context
	private transition: DirectiveTransition
	private templates: Template[] = []
	private currentTemplate: Template | null = null

	constructor(anchorNode: NodeAnchor, context: Context, result: TemplateResult | string, options?: DirectiveTransitionOptions) {
		this.anchorNode = anchorNode
		this.context = context
		this.transition = new DirectiveTransition(context, options)
		this.context = context

		if (result) {
			this.initResult(result, true)
		}
	}

	private initResult(result: TemplateResult | string, firstTime: boolean = false) {
		if (typeof result === 'string') {
			result = text`${result}`
		}
		
		let template = new Template(result, this.context)
		let fragment = template.nodeRange.getFragment()
		this.anchorNode.insert(fragment)

		if (this.transition.shouldPlayEnterMayAtStart(firstTime)) {
			this.playEnterTransition(template)
		}

		this.currentTemplate = template
		this.templates.push(template)
	}

	private async playEnterTransition(template: Template) {
		let firstElement = template.nodeRange.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined
		if (firstElement) {
			await this.transition.playEnterAt(firstElement)
		}
	}

	canMergeWith(): boolean {
		return true
	}

	merge(result: TemplateResult | string, options?: DirectiveTransitionOptions) {
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
					this.anchorNode.insert(template.nodeRange.getFragment())
					this.playEnterTransition(template)
					this.currentTemplate = template
				}
				else {
					this.initResult(result)
				}
			}
		}
		else {
			if (this.currentTemplate) {
				this.cacheCurrentTemplate()
			}
		}
	}

	private async cacheCurrentTemplate() {
		let template = this.currentTemplate!
		let firstElement = template.nodeRange.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined

		// Cached elements have been moved, reset the anchor node to current parent node.
		if (this.anchorNode.type === NodeAnchorType.Next && firstElement && firstElement.parentNode && firstElement.parentNode !== this.anchorNode.el.parentNode) {
			this.anchorNode = new NodeAnchor(firstElement.parentNode, NodeAnchorType.Parent)
		}

		if (this.transition.shouldPlay() && firstElement) {
			let finish = await this.transition.playLeaveAt(firstElement)
			if (finish) {
				template.nodeRange.cacheFragment()
			}
		}
		else {
			template.nodeRange.cacheFragment()
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
export const cache = defineDirective(CacheDirective) as (result: TemplateResult | string, options?: DirectiveTransitionOptions) => DirectiveResult
