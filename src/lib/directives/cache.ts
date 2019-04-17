import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template, AnchorNode} from '../parts'
import {text} from '../parts/template-result'
import {Transition, TransitionOptions, ShortTransitionOptions, formatShortTransitionOptions} from '../transition'
import {Context} from '../component'


class CacheDirective implements Directive {

	private anchorNode: AnchorNode
	private context: Context
	private templates: Template[] = []
	private currentTemplate: Template | null = null
	private transitionOptions: TransitionOptions | null = null

	constructor(anchorNode: AnchorNode, context: Context, result: TemplateResult | string, transitionOptions?: ShortTransitionOptions) {
		this.anchorNode = anchorNode
		this.context = context

		if (result) {
			this.initResult(result)
		}

		// Doesn't play transition for the first time, but when merge.
		this.initTransitionOptions(transitionOptions)
	}

	private initResult(result: TemplateResult | string) {
		if (typeof result === 'string') {
			result = text`${result}`
		}
		
		let template = new Template(result, this.context)
		let fragment = template.getFragment()
		this.anchorNode.before(fragment)
		this.mayPlayEnterTransition(template)
		this.currentTemplate = template
		this.templates.push(template)
	}

	private mayPlayEnterTransition(template: Template) {
		if (this.transitionOptions) {
			let firstElement = template.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined
			if (firstElement) {
				new Transition(firstElement, this.transitionOptions).enter()
			}
		}
	}

	private initTransitionOptions(transitionOptions: ShortTransitionOptions | undefined) {
		if (transitionOptions) {
			this.transitionOptions = formatShortTransitionOptions(transitionOptions)
		}
		else {
			this.transitionOptions = null
		}
	}

	canMergeWith(): boolean {
		return true
	}

	merge(result: TemplateResult | string, transitionOptions?: ShortTransitionOptions) {
		if (result) {
			if (typeof result === 'string') {
				result = text`${result}`
			}

			this.initTransitionOptions(transitionOptions)

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
					this.anchorNode.before(template.getFragment())
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

		if (this.transitionOptions) {
			let firstElement = template.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined
			if (firstElement) {
				new Transition(firstElement, this.transitionOptions).leave().then((finish: boolean) => {
					if (finish) {
						template.cacheFragment()
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

export const cache = defineDirective(CacheDirective) as (result: TemplateResult | string, transitionOptions?: ShortTransitionOptions) => DirectiveResult
