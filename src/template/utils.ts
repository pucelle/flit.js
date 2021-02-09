/** Parsed from template result, marked each value indices. */
export interface StringsAndValueIndices {
	strings: string[]
	valueIndices: number[]
}


/** Parsed from template result, marked each value indices. */
export interface StringsAndMayValueIndices {
	strings: string[] | null
	valueIndices: number[]
}


/** Join template strings with `${flit:id}`, the id is the increased index of values. */
export function joinWithOrderMarkers(strings: string[], startIndex: number = 0) {
	let text = strings[0]

	for (let i = 0; i < strings.length - 1; i++) {
		text += `{flit:${i + startIndex}}`
		text += strings[i + 1]
	}

	return text
}


/** Test if string contains `${flit:id}`. */
export function containsOrderMarker(string: string): boolean {
	return /\{flit:\d+\}/.test(string)
}


/** Test if string is exactly a `${flit:id}`. */
export function beOrderMarker(string: string): boolean {
	return /^\{flit:\d+\}$/.test(string)
}


/**
 * Split string contains `${flit:id}` into strings and valueIndices.
 * Returned property `strings` will be `null` if whole string is exactly a marker.
 */
export function parseOrderMarkers(string: string): StringsAndMayValueIndices {
	if (beOrderMarker(string)) {
		return {
			strings: null,
			valueIndices: [Number(string.match(/^\{flit:(\d+)\}$/)![1])]
		}
	}
	else {
		return splitByOrderMarkers(string)
	}
}

/** Split string contains `${flit:id}` into strings and valueIndices. */
export function splitByOrderMarkers(string: string): StringsAndValueIndices {
	let re = /\{flit:(\d+)\}/g
	let match: RegExpExecArray | null
	let strings: string[] = []
	let valueIndices: number[] = []
	let lastIndex = 0

	while (match = re.exec(string)) {
		strings.push(string.slice(lastIndex, match.index))
		valueIndices.push(Number(match[1]))
		lastIndex = re.lastIndex
	}

	strings.push(string.slice(lastIndex))

	return {
		strings,
		valueIndices,
	}
}


/** Extends attributes by merging class and style attributes, and setting normal attributes.  */
export function extendsAttributes(el: Element, attributes: {name: string, value: string}[]) {
	for (let {name, value} of attributes) {
		if ((name === 'class' || name === 'style') && el.hasAttribute(name)) {
			if (name === 'style') {
				value = (el.getAttribute(name) as string) + '; ' + value
			}
			else if (name === 'class') {
				value = (el.getAttribute(name) as string) + ' ' + value
			}
		}

		el.setAttribute(name, value)
	}
}


/** Join strings and values to a string, returns `values[0]` if `strings` is null. */
export function joinStringsAndValues(strings: TemplateStringsArray | string[] | null, values: any[] | null): any {
	if (!strings) {
		return values![0]
	}

	let text = strings[0]

	for (let i = 0; i < strings.length - 1; i++) {
		let value = values![i]
		text += value === null || value === undefined ? '' : String(value)
		text += strings[i + 1]
	}

	return text
}