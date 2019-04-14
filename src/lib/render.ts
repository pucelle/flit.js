import {TemplateResult, Template} from './parts'
import {Component} from './component';
import {watchImmediately} from './watcher'


/**
 * Render html codes or a template like html`...`, returns the rendered result as an document fragment.
 * If there is "@click=${...}" in template, you must pass a context like `render.call(context, ...)`.
 * @param codes The html code piece or html`...` template.
 */
export function render(this: unknown, codes: string | TemplateResult): DocumentFragment {
	let fragment: DocumentFragment

	if (codes instanceof TemplateResult) {
		let template = new Template(codes, this as any)
		fragment = template.getFragment()
	}
	else {
		let template = document.createElement('template')
		template.innerHTML = clearWhiteSpaces(codes)
		fragment = template.content
	}

	if (this instanceof Component) {
		this.__moveSlotsInto(fragment)
	}

	return fragment
}

function clearWhiteSpaces(htmlCodes: string): string {
	return htmlCodes.trim().replace(/>\s+/g, '>')
}


/**
 * Render template like html`...` returned from `renderFn`, returns the rendered result as an document fragment.
 * If there is "@click=${...}" in template, you must pass a context like `render.call(context, ...)`.
 * @param renderFn Returns template like html`...`
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as argument.
 */
export function renderAndFollow(this: unknown, renderFn: () => TemplateResult, onUpdate?: (fragment: DocumentFragment | null) => void): DocumentFragment {
	let template: Template | undefined

	let onResultChanged = (result: TemplateResult) => {
		if (template) {
			if (template.canMergeWith(result)) {
				template.merge(result)

				if (onUpdate) {
					onUpdate(null)
				}
			}
			else {
				template = new Template(result, this as any)

				if (onUpdate) {
					onUpdate(template.getFragment())
				}
			}
		}
		else {
			template = new Template(result, this as any)
		}
	}
	if (this instanceof Component) {
		this.watchImmediately(renderFn, onResultChanged)
	}
	else {
		watchImmediately(renderFn, onResultChanged)
	}
	
	let fragment = template!.getFragment()
	if (this instanceof Component) {
		this.__moveSlotsInto(fragment)
	}

	return fragment
}
