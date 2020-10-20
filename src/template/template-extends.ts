import {parseToHTMLTokens, HTMLTokenType, HTMLToken, joinHTMLTokens} from '../core/html-token'
import {TemplateResult} from './template-result'
import {StringsAndValueIndexes, joinWithOrderedMarkers, splitByOrderedMarkers} from './template-result-operate'


const extendsTemplateCache: Map<string, Map<string, StringsAndValueIndexes>> = new Map()


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
export function extendsTemplateResult(result: TemplateResult, superResult: TemplateResult): TemplateResult {
	let totalValues = [...result.values, ...superResult.values]

	let string = joinWithOrderedMarkers(result.strings as unknown as string[])
	let superString = joinWithOrderedMarkers(superResult.strings as unknown as string[], result.values.length)
	let stringsAndValueIndexes: StringsAndValueIndexes
	let cacheForSuper = extendsTemplateCache.get(string)

	if (cacheForSuper) {
		stringsAndValueIndexes = cacheForSuper.get(superString)!
	}

	if (!stringsAndValueIndexes!) {
		stringsAndValueIndexes = parseTemplateResultForExtending(string, superString)
	}
	
	let {strings, valueIndexes} = stringsAndValueIndexes!
	let reOrderedValues = valueIndexes.map(index => totalValues[index])

	return new TemplateResult(result.type, strings as unknown as TemplateStringsArray, reOrderedValues)
}

function parseTemplateResultForExtending(string: string, superString: string): StringsAndValueIndexes {
	let tokens = parseToHTMLTokens(string)
	let {attributes, slots, restTokens} = parseToRootPropertiesAndSlots(tokens)

	let superTokens = parseToSuperTokens(superString)
	assignRootPropertiesAndSlotsTo(superTokens, attributes, slots, restTokens)

	let stringsAndValueIndexes = splitByOrderedMarkers(joinHTMLTokens(superTokens))

	let cacheForSuper = extendsTemplateCache.get(string)
	if (!cacheForSuper) {
		cacheForSuper = new Map()
		extendsTemplateCache.set(string, cacheForSuper)
	}

	cacheForSuper.set(superString, stringsAndValueIndexes)

	return stringsAndValueIndexes
}

function parseToRootPropertiesAndSlots(tokens: HTMLToken[]) {
	let firstTagStartIndex = tokens.findIndex(token => token.type === HTMLTokenType.StartTag)!
	let firstTagEndIndex = tokens.length - 1
	let tabCount = 0
	let firstTag = tokens[firstTagStartIndex]

	let attributes = firstTag.attributes!
	let slots: {[key: string]: HTMLToken[]} = {}

	// Text nodes already been trimmed when parsing as tokens, no need to worry rest slot contains empty text.
	let restTokens: HTMLToken[] = []

	for (let i = 0; i < tokens.length; i++) {
		let token = tokens[i]
		switch (token.type) {
			case HTMLTokenType.StartTag:				
				if (/slot\s*=\s*['"](\w+)/.test(token.attributes!)) {
					let name = token.attributes!.match(/slot\s*=\s*['"](\w+)/)![1]
					let wholeTokensBelows = outOuterNestingTokens(tokens, i)
					slots[name] = slots[name] || []
					slots[name].push(...wholeTokensBelows)
					i--
				}
				else if (!token.selfClose) {
					tabCount++
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
		restTokens = tokens.slice(firstTagStartIndex + 1, firstTagEndIndex - 1)
	}

	return {attributes, slots, restTokens}
}

// Will add a template tag at start if don't have.
function parseToSuperTokens(string: string): HTMLToken[] {
	let tokens = parseToHTMLTokens(string)
	let firstToken = tokens[0]

	if (!firstToken || firstToken.type !== HTMLTokenType.StartTag || firstToken.tagName !== 'template') {
		tokens.unshift({
			type: HTMLTokenType.StartTag,
			tagName: 'template',
			attributes: '',
		})

		tokens.push({
			type: HTMLTokenType.EndTag,
			tagName: 'template',
		})
	}

	return tokens
}

function assignRootPropertiesAndSlotsTo(tokens: HTMLToken[], attributes: string, slots: {[key: string]: HTMLToken[]}, restTokens: HTMLToken[]) {
	tokens[0].attributes += attributes

	if (Object.keys(slots).length > 0 || restTokens.length > 0) {
		for (let i = 0; i < tokens.length; i++) {
			let token = tokens[i]
			switch (token.type) {
				case HTMLTokenType.StartTag:
					if (token.tagName === 'slot') {
						let nameMatch = token.attributes!.match(/name\s*=\s*['"](\w+)/)
						let name = nameMatch ? nameMatch[1] : null

						if (name) {
							if (slots[name]) {
								let tokenPieces = slots[name]

								// Keep `<slot name="">` so it may be overwrited by outers.
								outInnerNestingTokens(tokens, i)
								tokens.splice(i + 1, 0, ...tokenPieces)
								i += tokenPieces.length
							}
						}
						else {
							// Removes `<slot />` so different levels of rest contents will be merged.
							if (restTokens.length) {
								outOuterNestingTokens(tokens, i)
								tokens.splice(i, 0, ...restTokens)
								i += restTokens.length
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
