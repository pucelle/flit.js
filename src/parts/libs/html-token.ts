import {trim} from "./util";

export enum HTMLTokenType {
	StartTag,
	EndTag,
	Text
}

export interface HTMLToken {
	type: HTMLTokenType
	text?: string
	tagName?: string
	attributes?: string
}


const SELF_CLOSE_TAGS = [
	'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]


/**
 * Parse html codes to tokens.
 * After parsed, all comment was removed, and `\r\n\t` in text nodes was removed too.
 */
export function parseToHTMLTokens(string: string) {
	const tagRE = /<!--[\s\S]*?-->|<([\w-]+)([\s\S]*?)\/?>|<\/[\w-]+>/g

	let lastIndex = 0
	let tokens: HTMLToken[] = []
	
	let match: RegExpExecArray | null
	while (match = tagRE.exec(string)) {
		let piece = match[0]

		if (match.index > lastIndex) {
			let text = trim(string.slice(lastIndex, match.index))
			if (text) {
				tokens.push({
					type: HTMLTokenType.Text,
					text
				})
			}
		}

		lastIndex = tagRE.lastIndex
		
		if (piece[1] === '!') {
			continue
		}
		else if (piece[1] === '/') {
			tokens.push({
				type: HTMLTokenType.EndTag,
				tagName: piece.slice(2, -1),
			})
			continue
		}
		
		let tagName = match[1]
		let attributes = match[2]

		tokens.push({
			type: HTMLTokenType.StartTag,
			tagName,
			attributes,
		})

		//`<tag />` -> `<tag></tag>`
		// Benchmark: https://jsperf.com/array-includes-vs-object-in-vs-set-has
		if (piece[piece.length - 2] === '/' && !SELF_CLOSE_TAGS.includes(tagName)) {
			tokens.push({
				type: HTMLTokenType.EndTag,
				tagName,
			})
		}
	}

	if (lastIndex < string.length) {
		let text = trim(string.slice(lastIndex))
		if (text) {
			tokens.push({
				type: HTMLTokenType.Text,
				text: string.slice(lastIndex)
			})
		}
	}

	return tokens
}


/**
 * Join tokens that parsed from `parseToHTMLTokens` to HTML codes.
 */
export function joinHTMLTokens(tokens: HTMLToken[]): string {
	let codes = ''

	for (let token of tokens) {
		switch (token.type) {
			case HTMLTokenType.StartTag:
				let tagName = token.tagName!
				let attributes = token.attributes!

				codes += '<' + tagName + attributes + '>'
				break

			case HTMLTokenType.EndTag:
				codes += `</${token.tagName}>`
				break

			case HTMLTokenType.Text:
				codes += token.text!
				break
		}
	}

	return codes
}