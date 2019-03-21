export type TemplateType = 'html' | 'svg' | 'css' | 'text'


export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('html', strings, values)
}

export function svg(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('svg', strings, values)
}

export function css(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('css', strings, values)
}

export function text(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('text', strings, values)
}


/**
 * Created from each html`...` or svg`...`.
 * Every time call `Component.update` will generate a new template result tree.
 * Then we will check if each result can be merged or need to be replaced recursively.
 */
export class TemplateResult {

	type: TemplateType
	strings: TemplateStringsArray
	values: unknown[]

	constructor(type: TemplateType, strings: TemplateStringsArray, values: unknown[]) {
		this.type = type
		this.strings = strings
		this.values = values
	}
}


