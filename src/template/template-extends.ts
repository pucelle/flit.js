import {parseToHTMLTokens, HTMLTokenType, HTMLToken, joinHTMLTokens} from '../internals/html-token-parser'
import {TemplateResult} from './template-result'
import {joinWithOrderMarkers, splitByOrderMarkers, StringsAndValueIndices} from './utils'


/** 
 * Caches template extends result.
 * Next time extending of two same shaped template will capture a cached result.
 */
const TemplateExtendsCache: Map<string, Map<string, StringsAndValueIndices>> = new Map()


/**
 * Merge root attributes and slot elements from current result to super one.
 * This is used for `currentResult.extends(superResult)`.
 * 
 * What happens when multiple slot element `<slot name="...">` with same name exists:
 * 	 The outside most slot elements will exist, others will be removed.
 * 
 * What happens when multiple rest slot anchor elements `<slot />` exists in different template:
 *   The outside most rest slot elements will exist too, others will be removed.
 */
export function extendsTemplateResult(result: TemplateResult, superResult: TemplateResult): TemplateResult {
	let totalValues = [...result.values, ...superResult.values]

	let string = joinWithOrderMarkers(result.strings as string[])
	let superString = joinWithOrderMarkers(superResult.strings as string[], result.values.length)
	let stringsAndValueIndices: StringsAndValueIndices | undefined
	let cacheForSuper = TemplateExtendsCache.get(string)

	if (cacheForSuper) {
		stringsAndValueIndices = cacheForSuper.get(superString)!
	}

	if (!stringsAndValueIndices) {
		stringsAndValueIndices = parseTemplateResultForExtending(string, superString)
	}
	
	let {strings, valueIndices} = stringsAndValueIndices
	let reOrderedValues = valueIndices.map(index => totalValues[index])

	return new TemplateResult(result.type, strings, reOrderedValues)
}


/** Parse a template result to strings and value indices. */
function parseTemplateResultForExtending(string: string, superString: string): StringsAndValueIndices {
	let tokens = parseToHTMLTokens(string)
	let {attributes, slots, restTokens} = parseToRootAttributesAndSlots(tokens)

	let superTokens = wrapWithTemplateTokens(superString)
	assignRootAttributesAndSlotsTo(superTokens, attributes, slots, restTokens)

	let stringsAndValueIndices = splitByOrderMarkers(joinHTMLTokens(superTokens))

	let cacheForSuper = TemplateExtendsCache.get(string)
	if (!cacheForSuper) {
		cacheForSuper = new Map()
		TemplateExtendsCache.set(string, cacheForSuper)
	}

	cacheForSuper.set(superString, stringsAndValueIndices)

	return stringsAndValueIndices
}


/** Parse html token list to get attributes from root element, and get all slots. */
function parseToRootAttributesAndSlots(tokens: HTMLToken[]) {
	let firstTagStartIndex = tokens.findIndex(token => token.type === HTMLTokenType.StartTag)!
	let firstTagEndIndex = tokens.length - 1
	let tabCount = 0
	let firstTag = tokens[firstTagStartIndex]

	let attributes = firstTag.attributes!
	let slots: Record<string, HTMLToken[]> = {}

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


/** Add a `<template> to wrap current content if don't have. */
function wrapWithTemplateTokens(string: string): HTMLToken[] {
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


/** Assign attributes of root element and all slots to a html token list. */
function assignRootAttributesAndSlotsTo(tokens: HTMLToken[], attributes: string, slots: Record<string, HTMLToken[]>, restTokens: HTMLToken[]) {
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


/** Removes all inner tokens and current token in nesting pair. */
function outOuterNestingTokens(tokens: HTMLToken[], startTagIndex: number): HTMLToken[] {
	return tokens.splice(startTagIndex, findEndTagIndex(tokens, startTagIndex) + 1 - startTagIndex)
}


/** Removes all inner tokens in nesting pair. */
function outInnerNestingTokens(tokens: HTMLToken[], startTagIndex: number): HTMLToken[] {
	return tokens.splice(startTagIndex + 1, findEndTagIndex(tokens, startTagIndex) - 1 - startTagIndex)
}


/** Find the index of end tag that as end of current tag. */
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
