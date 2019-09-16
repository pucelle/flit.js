import {inheritTemplateResults} from './template-inherit'


export enum TemplateType {
	HTML,
	SVG,
	CSS,
	Text,
}

export interface StringsAndValueIndexes {
	strings: string[]
	valueIndexes: number[]
}


/** HTML template literal that can be used to render or update a component. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult(TemplateType.HTML, strings, values)
}

/** SVG template literal that can be used to render or update a component. */
export function svg(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult(TemplateType.SVG, strings, values)
}

/** CSS template literal that can be used as component's static style property. */
export function css(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult(TemplateType.CSS, strings, values)
}

/** Text template literal that used inside. */
export function text(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
	return new TemplateResult(TemplateType.Text, strings, values)
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
	 * Now using `CurrentRenderingResult.inherit(super.render())`, you can do this.
	 * 
	 * At beginning, we decided to implement this by rendering `<super-com>`,
	 * but every time for every rendered component to update, it need to check the name.
	 * We should makesure the rendering logic simple and easy to understand,
	 * so finally we implement a new API `inherit` to call it manually.
	 */
	inherit(superResult: TemplateResult): TemplateResult {
		if (this.type === TemplateType.HTML || this.type === TemplateType.SVG) {
			return inheritTemplateResults(this, superResult)
		}
		else {
			return new TemplateResult(this.type, [...superResult.strings, ...this.strings] as unknown as TemplateStringsArray, [...superResult.values, ...this.values])
		}
	}
}


/**
 * Get the start tag of a `TemplateResult`.
 */
export function getStartTagOfTemplateResult(result: TemplateResult): string | null {
	let match = result.strings[0].match(/<([\w-]+)/)
	return match ? match[1] : null
}


/**
 * Join template strings with `${flit:id}`, the id is the increased index of values.
 */
export function joinWithOrderedMarkers(strings: string[], startIndex: number = 0) {
	let text = strings[0]

	for (let i = 0; i < strings.length - 1; i++) {
		text += `{flit:${i + startIndex}}`
		text += strings[i + 1]
	}

	return text
}


/**
 * Test if string contains `${flit:id}`.
 */
export function containsOrderedMarker(string: string): boolean {
	return /\{flit:\d+\}/.test(string)
}


/**
 * Test if string is just a `${flit:id}`.
 */
export function beOrderedMarker(string: string): boolean {
	return /^\{flit:\d+\}$/.test(string)
}


/**
 * Split string contains `${flit:id}` into strings and valueIndexes.
 * But returned `strings` will be `null` if whole string be a marker.
 */
export function parseOrderedMarkers(string: string): {strings: string[] | null, valueIndexes: number[] | null} {
	if (beOrderedMarker(string)) {
		return {
			strings: null,
			valueIndexes: [Number(string.match(/^\{flit:(\d+)\}$/)![1])]
		}
	}
	else {
		return splitByOrderedMarkers(string)
	}
}

/** Split string contains `${flit:id}` into strings and valueIndexes. */
export function splitByOrderedMarkers(string: string): {strings: string[], valueIndexes: number[]} {
	let re = /\{flit:(\d+)\}/g
	let match: RegExpExecArray | null
	let strings: string[] = []
	let valueIndexes: number[] = []
	let lastIndex = 0

	while (match = re.exec(string)) {
		strings.push(string.slice(lastIndex, match.index))
		valueIndexes.push(Number(match[1]))
		lastIndex = re.lastIndex
	}

	strings.push(string.slice(lastIndex))

	return {
		strings,
		valueIndexes
	}
}
