import {TemplateResult, Template} from './parts'


/**
 * Render html codes or a html`...` template, returns the rendered result as an document fragment.
 * If there is "@click=${...}" in template, you may need to pass a context like `render.call(context, ...)`.
 * @param codes The html code piece or html`...` template.
 */
export function render(codes: string | TemplateResult): DocumentFragment

/**
 * Render html codes or a html`...` template, returns the first node of the rendered result.
 * If there is "@click=${...}" in template, you may need to pass a context like `render.call(context, ...)`.
 * @param codes The html code piece or html`...` template.
 * @param target Append the render result to target lement.
 */
export function render(codes: string | TemplateResult, target: HTMLElement): Node | null


export function render(this: unknown, codes: string | TemplateResult, target?: HTMLElement): DocumentFragment | Node | null {
	let fragment: DocumentFragment

	if (codes instanceof TemplateResult) {
		// let hasFunctionValue = codes.values.some(v => typeof v === 'function')
		// if (hasFunctionValue && !this || this === window) {
		// 	console.warn(`You may need to call "render.call(context)" to specify a context when there is function type values in the template`)
		// }
		let template = new Template(codes, this as any)
		fragment = template.parseToFragment()
	}
	else {
		let template = document.createElement('template')
		template.innerHTML = clearWhiteSpaces(codes)
		fragment = template.content
	}

	if (target) {
		let firstNode = fragment.firstChild
		target.append(fragment)
		return firstNode
	}
	else {
		return fragment
	}
}


function clearWhiteSpaces(htmlCodes: string): string {
	return htmlCodes.trim().replace(/>\s+/g, '>')
}
