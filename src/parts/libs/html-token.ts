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

export function parseToHTMLTokens(string: string) {
	const tagRE = /<!--[\s\S]*?-->|<([\w-]+)([\s\S]*?)>|<\/[\w-]+>/g

	let lastIndex = 0
	let tokens: HTMLToken[] = []
	
	let match: RegExpExecArray | null
	while (match = tagRE.exec(string)) {
		let piece = match[0]

		if (match.index > lastIndex) {
			tokens.push({
				type: HTMLTokenType.Text,
				text: string.slice(lastIndex, match.index)
			})
		}

		lastIndex = tagRE.lastIndex
		
		// Ignore existed comment nodes
		// An issue here: if comment codes includes `${...}`,
		// We just remove it but not the tempalte values,
		// So the followed values will be used to fill the wrong holes.
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
		tokens.push({
			type: HTMLTokenType.Text,
			text: string.slice(lastIndex)
		})
	}

	return tokens
}
