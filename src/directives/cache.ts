import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../template'
import type {Context} from '../component'
import {NodeAnchor} from "../internals/node-anchor"
import {ContextualTransition, ContextualTransitionOptions} from '../internals/contextual-transition'


export class CacheDirective implements Directive {

	protected readonly anchor: NodeAnchor
	protected readonly context: Context
	protected readonly transition: ContextualTransition
	protected readonly templates: Template[] = []

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

				// Find one that can be reused.
				let template = this.templates.find(t => t.canPathBy(result as TemplateResult))
				if (template) {
					template.patch(result)
					this.anchor.insert(template.extractToFragment())
					this.tryPlayEnterTransition(template)
					this.currentTemplate = template
				}

				// Create new.
				else {
					this.makeNewTemplate(result)
				}
			}
		}
		else {

			// Moves out current.
			if (this.currentTemplate) {
				this.movesOutCurrentTemplate()
			}
		}
	}

	protected async movesOutCurrentTemplate() {
		let template = this.currentTemplate!
		let playing = false

		if (this.transition.shouldPlayLeave()) {
			let firstElement = template.getFirstElement() as HTMLElement
			if (firstElement) {
				this.transition.playLeave(firstElement).then((finish: boolean) => {
					if (finish) {
						template.movesOut()
					}
				})

				playing = true
			}
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
		this.templates.push(template)
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
 * `cache(changableContent, ?options)` will toggle rendering content, and also cache old content to restore it quickly.
 * Note that when old rendering result restored, the scroll positions in it will fall back to start position.
 * 
 * @param result The html`...` result, can be `null` or an empty string.
 * @param options Options for transition.
 */
export const cache = defineDirective(CacheDirective) as (result: TemplateResult | '' | null, options?: ContextualTransitionOptions) => DirectiveResult
