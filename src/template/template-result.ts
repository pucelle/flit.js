import {extendsTemplateResult} from './template-extends'


/** All template types. */
export type TemplateType = 'html' | 'css' | 'svg'


/** Returns a HTML template literal, can be used to render or update a component. */
export function html(strings: TemplateStringsArray, ...values: any[]): TemplateResult {
	return new TemplateResult('html', strings, values)
}


/** Returns a SVG template literal, can be used to render or update a component. */
export function svg(strings: TemplateStringsArray, ...values: any[]): TemplateResult {
	return new TemplateResult('svg', strings, values)
}


/** Returns a CSS template literal, can be used as component's static style property. */
export function css(strings: TemplateStringsArray, ...values: any[]): TemplateResult {
	return new TemplateResult('css', strings, values)
}


/**
 * Created from each html`...` or svg`...`.
 * Every time call `component.update` will generate a new template result,
 * then we will use this result to merge or replaced old one.
 */
export class TemplateResult {

	readonly type: TemplateType
	readonly strings: TemplateStringsArray | string[]
	readonly values: any[]

	constructor(type: TemplateType, strings: TemplateStringsArray | string[], values: any[]) {
		this.type = type
		this.strings = strings
		this.values = values
	}

	/** 
	 * Join strings and values to string.
	 * Just for debugging.
	 */
	toString(): string {
		let text = this.strings[0]

		for (let i = 0; i < this.strings.length - 1; i++) {
			let value = this.values[i]

			if (value !== null && value !== undefined) {
				if (Array.isArray(value)) {
					text += value.join('')
				}
				else {
					text += String(value)
				}
			}

			text += this.strings[i + 1]
		}

		return text
	}

	/** 
	 * A template result can extend another:
	 * "css`...`.extends(...)" will join them.
	 * "html`...`.extends(...)" is different, see the comments below.
	 * 
	 * For `html` or `svg` template the extends will merge root attributes and slot elements into super,
	 * so you can reuse super rendering result and add some classes or styles and set same slots,
	 */
	extends(superResult: TemplateResult): TemplateResult {
		if (this.type === 'html' || this.type === 'svg') {
			return extendsTemplateResult(this, superResult)
		}
		else {
			return new TemplateResult(
				this.type,
				[...superResult.strings, ...this.strings],
				[...superResult.values, '', ...this.values]
			)
		}
	}
}
