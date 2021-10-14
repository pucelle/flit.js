import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../template'
import {Context} from '../component'
import {NodeAnchor} from "../internals/node-anchor"
import {ContextualTransition, ContextualTransitionOptions} from '../internals/contextual-transition'


/** 
 * Compare to `cache`, if we just want to toggle and play enter and leave transition,
 * and don't want to cache elements, we will need this directive.
 */
export class ToggleDirective implements Directive {

	protected readonly anchor: NodeAnchor
	protected readonly context: Context
	protected readonly transition: ContextualTransition

	protected currentTemplate: Template | null = null

	constructor(anchor: NodeAnchor, context: Context) {
		this.anchor = anchor
		this.context = context
		this.transition = new ContextualTransition(context)
	}

	canPatchBy(): boolean {
		return true
	}

	patch(result: TemplateResult | '' | null, options?: ContextualTransitionOptions) {
		this.transition.updateOptions(options)

		if (result) {

			// Matches, merge them. will not play transition.
			if (this.currentTemplate && this.currentTemplate.canPathBy(result)) {
				this.currentTemplate.patch(result)
			}
			else {

				// Moves out current.
				if (this.currentTemplate) {
					this.movesOutCurrentTemplate()
				}

				this.makeNewTemplate(result)
			}
		}
		else {

			// Moves out current.
			if (this.currentTemplate) {
				this.movesOutCurrentTemplate()
			}
		}
	}
	
	protected async playEnterTransition(template: Template) {
		let firstElement = template.getFirstElement() as HTMLElement
		if (firstElement) {
			await this.transition.playEnter(firstElement)
		}
	}

	protected async movesOutCurrentTemplate() {
		let template = this.currentTemplate!
		let playing = false

		if (this.transition.shouldPlayLeave()) {
			let firstElement = template.getFirstElement() as HTMLElement
			if (firstElement) {
				let finish = await this.transition.playLeave(firstElement)
				if (finish) {
					template.remove()
				}
			}

			playing = true
		}

		if (!playing) {
			template.movesOut()
		}

		this.currentTemplate = null
	}

	protected makeNewTemplate(result: TemplateResult) {
		let template = new Template(result, this.context)
		this.anchor.insert(template.extractToFragment())
		this.tryPlayEnterTransition(template)
		this.currentTemplate = template
	}

	protected async tryPlayEnterTransition(template: Template) {
		if (this.transition.shouldPlayEnter()) {
			let firstElement = template.getFirstElement() as HTMLElement
			if (firstElement) {
				await this.transition.playEnter(firstElement)
			}
		}
	}

	remove() {
		if (this.currentTemplate) {
			this.currentTemplate.remove()
		}
	}
}


/**
 * `toggle(changableContent, ?options)` toggles rendering content and can play enter or leave transition easily.
 * 
 * @param result The html`...` result, can be `null` or empty string.
 * @param options Options for transition.
 */
export const toggle = defineDirective(ToggleDirective) as (result: TemplateResult | '' | null, options?: ContextualTransitionOptions) => DirectiveResult
