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


export class TemplateResult {

	type: TemplateType
	strings: TemplateStringsArray
	values: unknown[]
	
	/**
	 * Created from each html`...` or svg`...`.
	 * Every time call `Component.update` will generate a new template result tree.
	 * Then we will check if each result can be merged or need to be replaced recursively.
	 */
	constructor(type: TemplateType, strings: TemplateStringsArray, values: unknown[]) {
		this.type = type
		this.strings = strings
		this.values = values
	}

	/** Join strings and values to string. */
	join(): string {
		let text = this.strings[0]

		for (let i = 0; i < this.strings.length - 1; i++) {
			let value = this.values[i]
			text += value === null || value === undefined ? '' : String(value)
			text += this.strings[i + 1]
		}

		return text
	}
}

