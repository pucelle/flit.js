import {trim} from '../helpers/utils'


/** Parsed HTML token. */
export interface HTMLToken {
	type: HTMLTokenType
	text?: string
	tagName?: string
	selfClose?: boolean
	attributes?: string
}

/** HTML token type. */
export enum HTMLTokenType {
	StartTag,
	EndTag,
	Text
}


/** Tags that self closed. */
const SelfClosedTags = [
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
]


/**
 * Parse html codes to tokens.
 * After parsing, all comment was removed, and `\r\n\t` in text nodes was removed too.
 * Automatically fix `<tag />` to `<tag></tag>` for not self close tags.
 * attributes are not been trimmed.
 */
export function parseToHTMLTokens(string: string): HTMLToken[] {
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
					text,
				})
			}
		}

		lastIndex = tagRE.lastIndex
		
		if (piece[1] === '!') {
			continue
		}
		else if (piece[1] === '/') {
			let tagName = piece.slice(2, -1)

			if (!SelfClosedTags.includes(tagName)) {
				tokens.push({
					type: HTMLTokenType.EndTag,
					tagName,
				})
			}
		}
		else {
			let tagName = match[1]
			let attributes = match[2]
			let selfClose = SelfClosedTags.includes(tagName)

			tokens.push({
				type: HTMLTokenType.StartTag,
				tagName,
				attributes,
				selfClose,
			})

			//`<tag />` -> `<tag></tag>`
			if (piece[piece.length - 2] === '/' && !selfClose) {
				tokens.push({
					type: HTMLTokenType.EndTag,
					tagName,
				})
			}
		}
	}

	if (lastIndex < string.length) {
		let text = trim(string.slice(lastIndex))
		if (text) {
			tokens.push({
				type: HTMLTokenType.Text,
				text: string.slice(lastIndex),
			})
		}
	}

	return tokens
}


/** Join tokens parsed from `parseToHTMLTokens` to HTML codes. */
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