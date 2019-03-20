import {TemplateType} from '../template'
import {PartType} from './shared'


export interface ParseResult {
	fragment: DocumentFragment,
	nodesInPlaces: Node[] | null
	places: Place[] | null
}

export interface Place {
	readonly type: PartType
	readonly name: string | null
	readonly strings: string[] | null
	readonly width: number
	readonly nodeIndex: number
}

export interface SharedParseReulst {
	readonly template: HTMLTemplateElement
	readonly valuePlaces: Place[]
}


const parseResultMap: Map<string, SharedParseReulst> = new Map()

const VALUE_MARKER = '${flit}'

const SELF_CLOSE_TAGS = {
	area: true,
	base: true,
	br: true,
	col: true,
	embed: true,
	hr: true,
	img: true,
	input: true,
	link: true,
	meta: true,
	param: true,
	source: true,
	track: true,
	wbr: true
}


export function parse(type: TemplateType, strings: string[]): ParseResult {
	if (type === 'html' || type === 'svg') {
		let string = strings.join(VALUE_MARKER)
		let sharedResult = parseResultMap.get(string)
		if (!sharedResult) {
			sharedResult = new ElementParser(type, string).parse()
			parseResultMap.set(string, sharedResult)
		}

		return generateParseResult(sharedResult)
	}
	else {
		return {
			fragment: createTemplate(strings[0].trim()).content,
			nodesInPlaces: null,
			places: null
		}
	}
}

function createTemplate(html: string) {
	let template = document.createElement('template')
	template.innerHTML = html
	return template
}



class ElementParser {

	private type: TemplateType
	private string: string
	private lastIndex = 0
	private nodeIndex = 0
	private places: Place[] = []
	private placeNodeIndexs: number[] = []
	

	constructor(type: TemplateType, string: string) {
		this.type = type
		this.string = string
	}

	parse(): SharedParseReulst {
		const tagRE = /<!--[\s\S]*?-->|<(\w+)([\s\S]*?)\/?>|<\/\w+>/g

		let codes = ''
		
		let isFirstTag = false
		let svgWrapped = false

		let match: RegExpExecArray | null
		while (match = tagRE.exec(this.string)) {
			let code = match[0]
			codes += this.parseText(this.string.slice(this.lastIndex, tagRE.lastIndex - code.length))
			
			//ignore comment nodes
			if (code[1] === '!') {
				continue
			}

			if (code[1] === '/') {
				codes += code
			}
			else {
				let tag = match[1]
				let attr = match[2]

				if (!isFirstTag) {
					if (this.type === 'svg' && tag !== 'svg') {
						codes = '<svg>' + codes
						svgWrapped = true
					}
					isFirstTag = true
				}

				if (attr.length > 5) {
					attr = this.parseAttribute(attr)
				}

				codes += '<' + tag + attr + '>'

				//`<div/>` -> `<div></div>`
				if (code[code.length - 2] === '/' && !SELF_CLOSE_TAGS.hasOwnProperty(tag)) {
					codes += '</' + tag + '>'
				}

				this.nodeIndex++
			}
		}

		codes += this.parseText(this.string.slice(this.lastIndex))

		if (svgWrapped) {
			codes += '</svg>'
		}

		let template = createTemplate(codes)
		if (svgWrapped) {
			let svg = template.content.firstElementChild!
			template.content.append(...svg.childNodes)
			svg.remove()
		}

		return {
			template,
			valuePlaces: this.places
		}
	}

	parseText(text: string): string {
		text = text.trim()
		if (!text) {
			return text
		}

		if (text.includes(VALUE_MARKER)) {
			let splitted = text.split(VALUE_MARKER)
			text = splitted.join('<!--->')

			for (let i = 1; i < splitted.length; i++) {
				this.places.push({
					type: PartType.Child,
					name: null,
					strings: null,
					width: 1,
					nodeIndex: this.nodeIndex
				})

				this.placeNodeIndexs.push(this.nodeIndex)
				this.nodeIndex += 1
			}
		}

		return text
	}

	parseAttribute(attr: string): string {
		const attrRE = /(\S+)\s*=\s*(".*?"|'.*?'|\$\{flit\})\s*/g

		return attr.replace(attrRE, (m0, name: string, value: string) => {
			let type: PartType | undefined = undefined
			let hasMarker = value.includes(VALUE_MARKER)

			switch (name[0]) {
				case '.':
					type = PartType.Property
					break

				case ':':
					type = PartType.Bind
					break

				case '?':
					type = PartType.MayAttr
					break

				case '@':
					type = PartType.Event
					break
			}

			if (type !== undefined) {
				name = name.slice(1)

				if (hasMarker) {
					type = PartType.Attr
				}
			}

			if (type !== undefined) {
				if (value[0] === '\'' || value[0] === '"') {
					value = value.slice(1, -1)
				}

				let strings = value === VALUE_MARKER || type === PartType.MayAttr || type === PartType.Event ? null
					: hasMarker ? value.split(VALUE_MARKER)
					: [value]
 
				this.places.push({
					type,
					name: name.slice(1),
					strings,
					width: strings ? strings.length - 1 : 1,
					nodeIndex: this.nodeIndex
				})

				this.placeNodeIndexs.push(this.nodeIndex)

				if (type === PartType.Attr) {
					return name + '="" '
				}
				else {
					return ''
				}
			}
			
			return m0
		})
	}
}


//Benchmark: https://jsperf.com/treewalker-vs-nodeiterator
function generateParseResult(sharedResult: SharedParseReulst): ParseResult {
	let {template, valuePlaces} = sharedResult
	let fragment = template.content.cloneNode(true) as DocumentFragment
	let nodeIndex = 0	//ignore root fragment
	let valueIndex = 0
	let nodesInPlaces: Node[] = []

	let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null)
	let node: Node | null

	while(node = walker.nextNode()) {
		if (valuePlaces[valueIndex].nodeIndex === nodeIndex) {
			nodesInPlaces.push(node)
			valueIndex++

			if (valueIndex === valuePlaces.length) {
				break
			}
		}

		nodeIndex++
	}

	return {
		fragment,
		nodesInPlaces,
		places: valuePlaces
	}
}