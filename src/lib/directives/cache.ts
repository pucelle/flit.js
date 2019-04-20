import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template, AnchorNode} from '../parts'
import {text} from '../parts/template-result'
import {Transition} from '../transition'
import {Context} from '../component'
import {AnchorNodeType} from '../parts/shared'
import {DirectiveTransition, DirectiveTransitionOptions} from './shared'


class CacheDirective extends DirectiveTransition implements Directive {

	private anchorNode: AnchorNode
	private templates: Template[] = []
	private currentTemplate: Template | null = null

	constructor(anchorNode: AnchorNode, context: Context, result: TemplateResult | string, options?: DirectiveTransitionOptions) {
		super(context)
		this.initTransitionOptions(options)

		this.anchorNode = anchorNode
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
		let fragment = template.getFragment()
		this.anchorNode.insert(fragment)

		if (!firstTime || this.enterAtStart) {
			this.mayPlayEnterTransition(template)
		}

		this.currentTemplate = template
		this.templates.push(template)
	}

	private mayPlayEnterTransition(template: Template) {
		if (this.transitionOptions) {
			let firstElement = template.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined
			if (firstElement) {
				new Transition(firstElement, this.transitionOptions).enter().then((finish: boolean) => {
					if (this.onend) {
						this.onend.call(this.context, 'enter', finish)
					}
				})
			}
		}
	}

	canMergeWith(): boolean {
		return true
	}

	merge(result: TemplateResult | string, options?: DirectiveTransitionOptions) {
		this.initTransitionOptions(options)

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
					this.anchorNode.insert(template.getFragment())
					this.mayPlayEnterTransition(template)
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

	private cacheCurrentTemplate() {
		let template = this.currentTemplate!
		let firstElement = template.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined

		// Cached elements have been moved, reset the anchor node to current parent node.
		if (this.anchorNode.type === AnchorNodeType.Next && firstElement && firstElement.parentNode && firstElement.parentNode !== this.anchorNode.el.parentNode) {
			this.anchorNode = new AnchorNode(firstElement.parentNode, AnchorNodeType.Parent)
		}

		if (this.transitionOptions) {
			if (firstElement) {
				new Transition(firstElement, this.transitionOptions).leave().then((finish: boolean) => {
					if (finish) {
						template.cacheFragment()
					}

					if (this.onend) {
						this.onend.call(this.context, 'leave', finish)
					}
				})
			}
			else {
				template.cacheFragment()
			}
		}
		else {
			template.cacheFragment()
		}

		this.currentTemplate = null
	}

	remove() {
		if (this.currentTemplate) {
			this.currentTemplate.remove()
		}
	}
}

export const cache = defineDirective(CacheDirective) as (result: TemplateResult | string, options?: DirectiveTransitionOptions) => DirectiveResult
