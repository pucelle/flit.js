import {extendsTemplateResult} from './template-extends'


export type TemplateType = 'html' | 'css' | 'svg' | 'text'


/** HTML template literal that can be used to render or update a component. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('html', strings, values)
}

/** SVG template literal that can be used to render or update a component. */
export function svg(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('svg', strings, values)
}

/** CSS template literal that can be used as component's static style property. */
export function css(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('css', strings, values)
}

/** Text template literal that used inside. */
/** @hidden */
export function text(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult('text', strings, values)
}


/**
 * Returned from html`...`, it represents a render result,
 * and can be used to merge with the last result.
 */
export class TemplateResult {

	type: TemplateType
	strings: TemplateStringsArray | string[]
	values: unknown[]

	/**
	 * Created from each html`...` or svg`...`.
	 * Every time call `Component.update` will generate a new template result tree.
	 * Then we will check if each result can be merged or need to be replaced recursively.
	 */
	constructor(type: TemplateType, strings: TemplateStringsArray | string[], values: unknown[]) {
		this.type = type
		this.strings = strings
		this.values = values
	}

	/** Join strings and values to string. */
	toString(): string {
		let text = this.strings[0]

		for (let i = 0; i < this.strings.length - 1; i++) {
			let value = this.values[i]
			text += value === null || value === undefined ? '' : String(value)
			text += this.strings[i + 1]
		}

		return text
	}

	/** 
	 * Used for `TemplateResult` to merge root attributes and slot elements into super.
	 * Sometimes you want to reuse super rendering result and add some classes and set soem slots,
	 * but normally this can only work when instantiation, not working inside a new defined component.
	 * Now using `CurrentRenderingResult.extends(super.render())`, you can do this.
	 * 
	 * At beginning, we decided to implement this by rendering `<super-com>`,
	 * but every time for every rendered component to update, it need to check the name.
	 * We should makesure the rendering logic simple and easy to understand,
	 * so finally we implement a new API `extends` to call it manually.
	 */
	extends(superResult: TemplateResult): TemplateResult {
		if (this.type === 'html' || this.type === 'svg') {
			return extendsTemplateResult(this, superResult)
		}
		else {
			return new TemplateResult(this.type, [...superResult.strings, ...this.strings] as unknown as TemplateStringsArray, [...superResult.values, ...this.values])
		}
	}
}
