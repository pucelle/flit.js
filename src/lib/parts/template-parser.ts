import {TemplateType} from './template-result'
import {PartType} from "./types"


export interface ParseResult {
	fragment: DocumentFragment
	places: Place[] | null
	nodesInPlaces: Node[] | null
	hasSlots: boolean
}

export interface Place {
	readonly type: PartType
	readonly name: string | null
	readonly strings: string[] | null
	readonly nodeIndex: number
	
	// Some binds like `:ref="name"`, it needs to be initialized but take no place
	readonly placeable: boolean
}

export interface SharedParseReulst {
	readonly template: HTMLTemplateElement
	readonly valuePlaces: Place[]
	readonly hasSlots: boolean
}


// context name -> template string -> parse result
const parseResultMap: Map<string, Map<string, SharedParseReulst>> = new Map()

const VALUE_MARKER = '${flit}'


/**
 * Parse template strings to an fragment and interlations and their related nodes.
 * Always prepend a comment in the front to mark current template start position.
 * @param type 
 * @param strings 
 */
export function parse(type: TemplateType, strings: TemplateStringsArray, contextName: string): ParseResult {
	if ((type === 'html' || type === 'svg')) {
		let string = strings.join(VALUE_MARKER)
		let sharedResultMap = parseResultMap.get(contextName)
		let sharedResult = sharedResultMap ? sharedResultMap.get(string) : null
		if (!sharedResult) {
			if (!sharedResultMap) {
				sharedResultMap = new Map()
				parseResultMap.set(contextName, sharedResultMap)
			}
			sharedResult = new ElementParser(type, string, contextName).parse()
			sharedResultMap.set(string, sharedResult)
		}

		return cloneParseResult(sharedResult)
	}
	else if (type === 'css') {
		let html = `<style>${strings[0].trim()}</style>`
		let fragment = createTemplateFromHTML(html).content

		return {
			fragment,
			nodesInPlaces: null,
			places: null,
			hasSlots: false
		}
	}
	else {
		let text = strings[0].trim()
		let fragment = document.createDocumentFragment()
		fragment.append(document.createTextNode(text))

		return {
			fragment,
			nodesInPlaces: null,
			places: null,
			hasSlots: false
		}
	}
}

function createTemplateFromHTML(html: string) {
	let template = document.createElement('template')
	template.innerHTML = html
	return template
}


class ElementParser {

	private type: TemplateType
	private string: string
	private nodeIndex = 0
	private places: Place[] = []
	private nodeIndexs: number[] = []
	private contextName: string

	constructor(type: TemplateType, string: string, contextName: string) {
		this.type = type
		this.string = string
		this.contextName = contextName
	}

	// Benchmark: https://jsperf.com/regexp-exec-match-replace-speed
	parse(): SharedParseReulst {
		const tagRE = /<!--[\s\S]*?-->|<(\w+)([\s\S]*?)>|<\/\w+>/g

		let codes = ''
		let lastIndex = 0
		let isFirstTag = false
		let svgWrapped = false
		let hasSlots = false

		let match: RegExpExecArray | null
		while (match = tagRE.exec(this.string)) {
			let code = match[0]
			codes += this.parseText(this.string.slice(lastIndex, tagRE.lastIndex - code.length))
			lastIndex = tagRE.lastIndex
			
			// Ignore existed comment nodes
			if (code[1] === '!') {
				continue
			}
			else if (code[1] === '/') {
				codes += code
				continue
			}
			
			let tag = match[1]
			let attr = match[2]

			if (tag === 'slot') {
				hasSlots = true
			}

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
			this.nodeIndex++
		}

		codes += this.parseText(this.string.slice(lastIndex))

		if (svgWrapped) {
			codes += '</svg>'
		}

		let template = createTemplateFromHTML(codes)
		if (svgWrapped) {
			let svg = template.content.firstElementChild!
			template.content.append(...svg.childNodes)
			svg.remove()
		}

		return {
			template,
			valuePlaces: this.places,
			hasSlots
		}
	}

	parseText(text: string): string {
		text = text.trim()
		if (!text) {
			return text
		}

		if (text.includes(VALUE_MARKER)) {
			let splitted = text.split(VALUE_MARKER)
			text = splitted.join('<!---->')

			for (let i = 1; i < splitted.length; i++) {
				this.places.push({
					type: PartType.Child,
					name: null,
					strings: null,
					nodeIndex: this.nodeIndex,
					placeable: true,
				})

				this.nodeIndexs.push(this.nodeIndex)
				this.nodeIndex += 1
			}
		}

		return text
	}

	parseAttribute(attr: string): string {
		const attrRE = /(\S+)\s*=\s*(".*?"|'.*?'|\$\{flit\})\s*/g

		return attr.replace(attrRE, (m0, name: string, value: string) => {
			let type: PartType | undefined = undefined
			let markerIndex = value.indexOf(VALUE_MARKER)

			switch (name[0]) {
				case '.':
					type = PartType.Property
					break

				case ':':
					type = PartType.Binding
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
			}

			if (type === undefined && markerIndex > -1) {
				type = PartType.Attr
			}

			if (markerIndex > -1 && value.slice(markerIndex + VALUE_MARKER.length).includes(VALUE_MARKER)) {
				throw new Error(`"${value}" is not allowed, at most one "\${...}" can be specified in each attribute value`)
			}

			if (type !== undefined) {
				if (value[0] === '\'' || value[0] === '"') {
					value = value.slice(1, -1)
				}

				let strings = value === VALUE_MARKER || type === PartType.MayAttr || type === PartType.Event ? null
					: markerIndex > -1 ? value.split(VALUE_MARKER)
					: [value]
 
				this.places.push({
					type,
					name,
					strings,
					nodeIndex: this.nodeIndex,
					placeable: markerIndex > -1
				})

				this.nodeIndexs.push(this.nodeIndex)

				if (type === PartType.Attr) {
					return name + '="" '
				}
				else {
					return ''
				}
			}
			else if (name === 'class') {
				return m0.replace(/\$(\w+)/g, '$1__' + this.contextName)
			}
			
			return m0
		})
	}
}


/**
 * Clone the result fragment and link it with node indexes from the parsed result.
 */
// TreeWalker Benchmark: https://jsperf.com/treewalker-vs-nodeiterator
// Clone benchmark: https://jsperf.com/clonenode-vs-importnode
function cloneParseResult(sharedResult: SharedParseReulst): ParseResult {
	let {template, valuePlaces, hasSlots} = sharedResult
	let fragment = template.content.cloneNode(true) as DocumentFragment
	let nodeIndex = 0
	let nodesInPlaces: Node[] = []

	if (valuePlaces.length > 0) {
		let valueIndex = 0
		let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null)
		let node: Node | null
		let end = false

		while (node = walker.nextNode()) {
			while (valuePlaces[valueIndex].nodeIndex === nodeIndex) {
				nodesInPlaces.push(node)
				valueIndex++

				if (valueIndex === valuePlaces.length) {
					end = true
					break
				}
			}

			if (end) {
				break
			}

			nodeIndex++
		}
	}

	return {
		fragment,
		nodesInPlaces,
		places: valuePlaces,
		hasSlots
	}
}