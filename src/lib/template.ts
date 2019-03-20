export type TemplateType = 'html' | 'svg' | 'css' | 'text'


export function html(strings: string[], values: any[]): Template {
	return new Template('html', strings, values)
}

export function svg(strings: string[], values: any[]): Template {
	return new Template('svg', strings, values)
}

export function css(strings: string[], values: any[]): Template {
	return new Template('css', strings, values)
}

export function text(strings: string[], values: any[]): Template {
	return new Template('text', strings, values)
}


export function join(strings: string[] | null, values: any[]): any {
	if (!strings) {
		return values[0]
	}

	let text = strings[0]

	for (let i = 0; i < strings.length - 1; i++) {
		let value = values[i]
		text += value === null || value === undefined ? '' : String(value)
		text += strings[i + 1]
	}

	return text
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

	compareValues(t: Template): number[] | null {
		let diff: number[] = []

		for (let i = 0; i < this.values.length; i++) {
			if (this.values[i] !== t.values[i]) {
				diff.push(i)
			}
		}

		return diff.length > 0 ? diff : null
	}
}
