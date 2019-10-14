import {TemplateResult} from './template-result'


export interface StringsAndValueIndexes {
	strings: string[]
	valueIndexes: number[]
}


/** Get the start tag of a `TemplateResult`. */
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
