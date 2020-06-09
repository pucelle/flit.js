import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../template'
import {Context} from '../component'
import {NodeAnchor} from "../libs/node-helper"
import {DirectiveTransition, DirectiveTransitionOptions} from '../libs/directive-transition'


/** 
 * Compare to `cache`, if we just want to play enter and leave transition,
 * and don't want to cache elements or leave it in document to hide,
 * we will need this directive.
 */
export class PlayDirective implements Directive {

	protected anchor: NodeAnchor
	protected context: Context
	protected transition: DirectiveTransition
	protected currentTemplate: Template | null = null

	constructor(anchor: NodeAnchor, context: Context) {
		this.anchor = anchor
		this.context = context
		this.transition = new DirectiveTransition(context)
	}

	canMergeWith(_result: TemplateResult | string | null): boolean {
		return true
	}

	merge(result: TemplateResult | '' | null, options?: DirectiveTransitionOptions) {
		this.transition.updateOptions(options)

		if (result) {
			if (this.currentTemplate && this.currentTemplate.canMergeWith(result)) {
				this.currentTemplate.merge(result)
			}
			else {
				if (this.currentTemplate) {
					this.playLeaveTransition(this.currentTemplate)
				}

				this.initNewResult(result)
			}
		}
		else {
			if (this.currentTemplate) {
				this.playLeaveTransition(this.currentTemplate)
				this.currentTemplate = null
			}
		}
	}
	
	protected async playEnterTransition(template: Template) {
		let firstElement = template.range.getFirstElement()
		if (firstElement) {
			await this.transition.playEnter(firstElement)
		}
	}

	protected async playLeaveTransition(template: Template) {
		let firstElement = template.range.getFirstElement()
		if (firstElement) {
			let finish = await this.transition.playLeave(firstElement)
			if (finish) {
				template.range.remove()
			}
		}
	}

	protected initNewResult(result: TemplateResult) {
		let template = new Template(result, this.context)
		let fragment = template.range.getFragment()
		this.anchor.insert(fragment)

		if (this.transition.shouldPlayEnter()) {
			this.playEnterTransition(template)
		}

		this.currentTemplate = template
	}

	remove() {
		if (this.currentTemplate) {
			this.currentTemplate.remove()
		}
	}
}


/**
 * Play enter transition when have rendering result, please leave transition when no result anymore.
 * @param result The html`...` result, can be null or empty string.
 */
export const play = defineDirective(PlayDirective) as (result: TemplateResult | '' | null, options?: DirectiveTransitionOptions) => DirectiveResult
