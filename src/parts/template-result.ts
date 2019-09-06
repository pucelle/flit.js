export type TemplateType = 'html' | 'svg' | 'css' | 'text'


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
	toString(): string {
		let text = this.strings[0]

		for (let i = 0; i < this.strings.length - 1; i++) {
			let value = this.values[i]
			text += value === null || value === undefined ? '' : String(value)
			text += this.strings[i + 1]
		}

		return text
	}
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
 * Test if string contains `${flit:id}`.
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

/**
 * Split string contains `${flit:id}` into strings and valueIndexes.
 */
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


// /**
//  * Merge root attributes and slot elements from front result to the later one.
//  * This is used when one component call super template by rendering `<super-name ...><tag slot="name">`.
//  * Slot elements in previous result can only be used and processed in current result, not later ones.
//  */
// export function mergeTemplateResults(...results: TemplateResult[]): TemplateResult {
	
// 	let slots: {[key: string]: TemplateResult} = {}
// 	for (let result of results) {

// 	}
// }

// export const FlitOrderMarderRE = /\{flit:\d+\}/g

// function parseTemplateResultToRootPropertiesAndSlots(result: TemplateResult): TemplateResult {
// 	const VALUE_MARKER = '${flit}'

// 	let string = result.strings.join(VALUE_MARKER)
// 	let tokens = 
// }
