import {TemplateResult, Template} from './parts'
import {Component, Context} from './component'
import {watchImmediately} from './watcher'


/**
 * Render html codes or a template like html`...`, returns the rendered result as an document fragment.
 * Note that if there is "@click=${...}" in template, you shou use `renderInContext(context, ...)`.
 * @param codes The html code piece or html`...` template.
 */
export function render(codes: TemplateResult | string): DocumentFragment {
	return renderMayInContext(null, codes)
}

/**
 * Render html codes or a template like html`...` in context, returns the rendered result as an document fragment.
 * If there is "@click=${...}" in template, you must pass a context like `render.call(context, ...)`.
 * @param context The context you used when rendering.
 * @param codes The html code piece or html`...` template.
 */
export function renderInContext(context: Component, codes: TemplateResult | string): DocumentFragment {
	return renderMayInContext(context, codes)
}

function renderMayInContext(context: Context, codes: TemplateResult | string): DocumentFragment {
	let fragment: DocumentFragment

	if (codes instanceof TemplateResult) {
		let template = new Template(codes, context)
		fragment = template.getFragment()
	}
	else {
		let template = document.createElement('template')
		template.innerHTML = clearWhiteSpaces(codes)
		fragment = template.content
	}

	return fragment
}

function clearWhiteSpaces(htmlCodes: string): string {
	return htmlCodes.trim().replace(/>\s+/g, '>')
}


/**
 * Render template like html`...` returned from `renderFn`, returns the rendered result as an document fragment.
 * If there is "@click=${...}" in template, you should use `renderAndFollowInContext(context, ...)`.
 * @param renderFn Returns template like html`...`
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as argument.
 */
export function renderAndFollow(renderFn: () => TemplateResult, onUpdate?: (fragment: DocumentFragment | null) => void) {
	return renderAndFollowMayInContext(null, renderFn, onUpdate)
}
	
/**
 * Render template like html`...` returned from `renderFn` in context, returns the rendered result as an document fragment.
 * If there is "@click=${...}" in template, you must pass a context like `render.call(context, ...)`.
 * @param context The context you used when rendering.
 * @param renderFn Returns template like html`...`
 * @param onUpdate Called when update after referenced data changed. if new result can't merge with old, will pass a new fragment as argument.
 */
export function renderAndFollowInContext(context: Component, renderFn: () => TemplateResult, onUpdate?: (fragment: DocumentFragment | null) => void) {
	return renderAndFollowMayInContext(context, renderFn, onUpdate)
}

function renderAndFollowMayInContext(context: Context, renderFn: () => TemplateResult, onUpdate?: (fragment: DocumentFragment | null) => void) {
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
				template = new Template(result, context)

				if (onUpdate) {
					onUpdate(template.getFragment())
				}
			}
		}
		else {
			template = new Template(result, context)
		}
	}

	let unwatch: () => void

	if (context) {
		unwatch = context.watchImmediately(renderFn, onResultChanged)
	}
	else {
		unwatch = watchImmediately(renderFn, onResultChanged)
	}
	
	let fragment = template!.getFragment()

	return {
		fragment,
		unwatch
	}
}
