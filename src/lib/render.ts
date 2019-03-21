import {TemplateResult} from './template-result'
import {Template} from './parts/template'


/**
 * Render html codes or a html`...` template, returns the rendered result as an document fragment.
 * @param codes The html code piece or html`...` template.
 */
export function render(codes: string | TemplateResult): DocumentFragment

/**
 * Render html codes or a html`...` template, returns the first node of the rendered result.
 * @param codes The html code piece or html`...` template.
 * @param target Append the render result to target lement.
 */
export function render(codes: string | TemplateResult, target: HTMLElement): Node | null


export function render(this: any, codes: string | TemplateResult, target?: HTMLElement): DocumentFragment | Node | null {
	let fragment: DocumentFragment

	if (codes instanceof TemplateResult) {
		let template = new Template(codes, this)
		fragment = template.parseMayTrack(false)
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
