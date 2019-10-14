import {parseToHTMLTokens, HTMLTokenType, HTMLToken, joinHTMLTokens} from '../libs/html-token'
import {TemplateResult} from './template-result'
import {StringsAndValueIndexes, joinWithOrderedMarkers, splitByOrderedMarkers} from './template-result-operate'


const inheritTemplateCache: Map<string, Map<string, StringsAndValueIndexes>> = new Map()


/**
 * Merge root attributes and slot elements from front result to the later one.
 * This is used when one component call super template by rendering `<super-name additional-properties><tag slot="name">`.
 * 
 * What happens when multiple slot element with same name exists:
 * 	 The outside most slot elements will exist, others will be removed.
 * 
 * What happens when multiple rest slot anchor elements (`<slot />`) exists in different template:
 *   The outside most rest slot elements will exist too, others will be removed.
 */
export function inheritTemplateResults(result: TemplateResult, superResult: TemplateResult): TemplateResult {
	let totalValues = [...result.values, ...superResult.values]

	let string = joinWithOrderedMarkers(result.strings as unknown as string[])
	let superString = joinWithOrderedMarkers(superResult.strings as unknown as string[], result.values.length)
	let stringsAndValueIndexes: StringsAndValueIndexes
	let cacheForSuper = inheritTemplateCache.get(string)

	if (cacheForSuper) {
		stringsAndValueIndexes = cacheForSuper.get(superString)!
	}

	if (!stringsAndValueIndexes!) {
		stringsAndValueIndexes = parseTemplateResultInheriting(string, superString)
	}
	
	let {strings, valueIndexes} = stringsAndValueIndexes!
	let reOrderedValues = valueIndexes.map(index => totalValues[index])

	return new TemplateResult(result.type, strings as unknown as TemplateStringsArray, reOrderedValues)
}

function parseTemplateResultInheriting(string: string, superString: string): StringsAndValueIndexes {
	let tokens = parseToHTMLTokens(string)
	let {attributes, slots, restSlot} = parseToRootPropertiesAndSlots(tokens)

	let superTokens = parseToHTMLTokens(superString)
	assignRootPropertiesAndSlotsTo(superTokens, attributes, slots, restSlot)

	let stringsAndValueIndexes = splitByOrderedMarkers(joinHTMLTokens(superTokens))

	let cacheForSuper = inheritTemplateCache.get(string)
	if (!cacheForSuper) {
		cacheForSuper = new Map()
		inheritTemplateCache.set(string, cacheForSuper)
	}

	cacheForSuper.set(superString, stringsAndValueIndexes)

	return stringsAndValueIndexes
}

function parseToRootPropertiesAndSlots(tokens: HTMLToken[]) {
	let firstTagStartIndex = tokens.findIndex(token => token.type === HTMLTokenType.StartTag)!
	let firstTagEndIndex = 0
	let tabCount = 0
	let firstTag = tokens[firstTagStartIndex]

	let attributes = firstTag.attributes!
	let slots: {[key: string]: HTMLToken[]} = {}

	// Text nodes already been trimmed when parsing as tokens, no need to worry rest slot exist with empty text.
	let restSlot: HTMLToken[] = []

	for (let i = 0; i < tokens.length; i++) {
		let token = tokens[i]
		switch (token.type) {
			case HTMLTokenType.StartTag:				
				if (!token.selfClose) {
					tabCount++
				}

				if (/slot\s*=\s*['"](\w+)/.test(token.attributes!)) {
					let name = token.attributes!.match(/slot\s*=\s*['"](\w+)/)![1]
					let wholeTokensBelows = outOuterNestingTokens(tokens, i)
					slots[name] = slots[name] || []
					slots[name].push(...wholeTokensBelows)
					i--
				}
				break

			case HTMLTokenType.EndTag:
				tabCount--
				if (tabCount === 0) {
					firstTagEndIndex = i + 1
				}
				break
		}
	}

	if (firstTagEndIndex - firstTagStartIndex > 2) {
		restSlot = tokens.slice(firstTagStartIndex + 1, firstTagEndIndex - 1)
	}

	return {attributes, slots, restSlot}
}

function assignRootPropertiesAndSlotsTo(tokens: HTMLToken[], attributes: string, slots: {[key: string]: HTMLToken[]}, restSlot: HTMLToken[]) {
	let firstTag = tokens.find(token => token.type === HTMLTokenType.StartTag)!
	firstTag.attributes += attributes

	if (Object.keys(slots).length > 0 || restSlot.length > 0) {
		for (let i = 0; i < tokens.length; i++) {
			let token = tokens[i]
			switch (token.type) {
				case HTMLTokenType.StartTag:
					if (token.tagName === 'slot') {
						let nameMatch = token.attributes!.match(/name\s*=\s*['"](\w+)/)
						let name = nameMatch ? nameMatch[1] : null

						if (name) {
							if (slots[name]) {
								outInnerNestingTokens(tokens, i)
								let tokenPieces = slots[name]
								tokens.splice(i + 1, 0, ...tokenPieces)
								i += tokenPieces.length
							}
						}
						else {
							outInnerNestingTokens(tokens, i)
							if (restSlot.length) {
								tokens.splice(i + 1, 0, ...restSlot)
								i += restSlot.length
							}
						}
					}
					break
			}
		}
	}
}

function outOuterNestingTokens(tokens: HTMLToken[], startTagIndex: number): HTMLToken[] {
	return tokens.splice(startTagIndex, findEndTagIndex(tokens, startTagIndex) + 1 - startTagIndex)
}

function outInnerNestingTokens(tokens: HTMLToken[], startTagIndex: number): HTMLToken[] {
	return tokens.splice(startTagIndex + 1, findEndTagIndex(tokens, startTagIndex) - 1 - startTagIndex)
}

function findEndTagIndex(tokens: HTMLToken[], startTagIndex: number): number {
	let tabCount = 1

	for (let i = startTagIndex + 1; i < tokens.length; i++) {
		let token = tokens[i]

		switch (token.type) {
			case HTMLTokenType.StartTag:
				if (!token.selfClose) {
					tabCount++
				}
				break

			case HTMLTokenType.EndTag:
				tabCount--
				if (tabCount === 0) {
					return i
				}
				break
		}
	}

	return tokens.length - 1
}
