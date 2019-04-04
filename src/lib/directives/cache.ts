import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../parts'
import {text} from '../parts/template-result'


export const cache = defineDirective(class CacheDirective extends Directive {

	private templates: Template[] = []
	private currentTemplate: Template | null = null

	initialize(result: TemplateResult | string) {
		if (typeof result === 'string') {
			result = text`${result}`
		}

		let template = new Template(result, this.context)
		let fragment = template.getFragment()
		this.endNode.before(fragment)
		this.currentTemplate = template
		this.templates.push(template)
	}

	canMergeWith(): boolean {
		return true
	}

	merge(result: TemplateResult | string) {
		if (typeof result === 'string') {
			result = text`${result}`
		}

		if (this.currentTemplate!.canMergeWith(result)) {
			this.currentTemplate!.merge(result)
		}
		else {
			this.currentTemplate!.cacheFragment()

			let template = this.templates.find(t => t.canMergeWith(result as TemplateResult))
			if (template) {
				template.merge(result)
				this.endNode.before(template.getFragment())
				this.currentTemplate = template
			}
			else {
				this.initialize(result)
			}
		}
	}
}) as (result: TemplateResult | string) => DirectiveResult
