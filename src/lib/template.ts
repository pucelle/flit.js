export type TemplateType = 'html' | 'svg' | 'css' | 'text'


export function html(strings: string[], values: any[]): Template {
	return new Template('html', strings, values)
}

export function svg() {

}

export function css() {
	
}


interface ValueDiff {
	index: number
	value: any
}

export class Template {

	type: TemplateType
	strings: string[]
	values: any[]

	constructor(type: TemplateType, strings: string[], values: any[]) {
		this.type = type
		this.strings = strings
		this.values = values
	}

	compareType(t: Template): boolean {
		return this.type === t.type
	}

	compareStrings(t: Template): boolean {
		if (this.strings.length !== t.strings.length) {
			return false
		}

		for (let i = 0; i < this.strings.length; i++) {
			if (this.strings[i] !== t.strings[i]) {
				return false
			}
		}

		return true
	}

	compareValues(t: Template): ValueDiff[] | null {
		let diff: ValueDiff[] = []

		for (let i = 0; i < this.values.length; i++) {
			if (this.values[i] !== t.values[i]) {
				diff.push({
					index: i,
					value: this.values[i]
				})
			}
		}

		return diff.length > 0 ? diff : null
	}
}





export function createTemplateFromHTMLCodes(htmlCodes: string): HTMLTemplateElement {
	let template = document.createElement('template')
	template.innerHTML = clearWhiteSpaces(htmlCodes)
	return template
}

function clearWhiteSpaces(htmlCodes: string): string {
	return htmlCodes.trimLeft().replace(/>[ \t\r\n]+/g, '>')
}

