import {TemplateType} from './template-result'
import {PartType} from "./types"
import {getScopedClassNameSet} from '../style'


export interface ParseResult {
	fragment: DocumentFragment
	places: Place[] | null
	nodesInPlaces: Node[] | null
	hasSlots: boolean
}

export interface Place {
	type: PartType
	name: string | null
	strings: string[] | null

	// Some binds like `:ref="name"`, it needs to be initialized but take no place
	// it's holes is `0`
	holes: number
	nodeIndex: number
}

export interface SharedParseReulst {
	template: HTMLTemplateElement
	places: Place[]
	hasSlots: boolean
	attributes: {name: string, value: string}[] | null
}

// context name -> template string -> parse result
const parseResultMap: Map<string, Map<string, SharedParseReulst>> = new Map()

const VALUE_MARKER = '${flit}'

const SELF_CLOSE_TAGS = [
	'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]
 

/**
 * Parse template strings to an fragment and interlations and their related nodes.
 * Always prepend a comment in the front to mark current template start position.
 * @param type 
 * @param strings 
 */
export function parse(type: TemplateType, strings: TemplateStringsArray, el: HTMLElement | null): ParseResult {
	let scopeName = el ? el.localName : 'global'

	if ((type === 'html' || type === 'svg')) {
		let string = strings.join(VALUE_MARKER)
		let sharedResultMap = parseResultMap.get(scopeName)
		let sharedResult = sharedResultMap ? sharedResultMap.get(string) : null
		if (!sharedResult) {
			if (!sharedResultMap) {
				sharedResultMap = new Map()
				parseResultMap.set(scopeName, sharedResultMap)
			}
			sharedResult = new ElementParser(type, string, scopeName).parse()
			sharedResultMap.set(string, sharedResult)
		}

		return cloneParseResult(sharedResult, el)
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
	private scopeName: string
	private scopedClassNameSet: Set<string> | undefined

	constructor(type: TemplateType, string: string, scopeName: string) {
		this.type = type
		this.string = string
		this.scopeName = scopeName
		this.scopedClassNameSet = getScopedClassNameSet(this.scopeName)
	}

	// Benchmark: https://jsperf.com/regexp-exec-match-replace-speed
	parse(): SharedParseReulst {
		const tagRE = /<!--[\s\S]*?-->|<(\w+)([\s\S]*?)>|<\/\w+>/g

		let codes = ''
		let lastIndex = 0
		let firstTag: string | null = null
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

			if (!firstTag) {
				firstTag = tag

				if (this.type === 'svg' && tag !== 'svg') {
					codes = '<svg>' + codes
					svgWrapped = true
				}
			}

			if (attr.length > 5) {
				attr = this.parseAttribute(attr)
			}

			codes += '<' + tag + attr + '>'

			//`<tag />` -> `<tag></tag>`
			// Benchmark: https://jsperf.com/array-includes-vs-object-in-vs-set-has
			if (code[code.length - 2] === '/' && !SELF_CLOSE_TAGS.includes(tag)) {
				codes += '</' + tag + '>'
			}

			this.nodeIndex++
		}

		codes += this.parseText(this.string.slice(lastIndex))

		if (svgWrapped) {
			codes += '</svg>'
		}

		let template = createTemplateFromHTML(codes)
		let attributes: {name: string, value: string}[] | null = null

		if (svgWrapped) {
			let svg = template.content.firstElementChild!
			template.content.append(...svg.childNodes)
			svg.remove()
		}

		if (firstTag === 'template') {
			template = template.content.firstChild as HTMLTemplateElement
			attributes = [...template.attributes].map(({name, value}) => ({name, value}))
		}

		return {
			template,
			places: this.places,
			hasSlots,
			attributes
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
					holes: 1,
					nodeIndex: this.nodeIndex
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
					holes: strings ? strings.length - 1 : 1,
					nodeIndex: this.nodeIndex
				})

				this.nodeIndexs.push(this.nodeIndex)

				if (type === PartType.Attr) {
					return name + '="" '
				}
				else {
					return ''
				}
			}
			else if (name === 'class' && this.scopedClassNameSet) {
				value = value.replace(/[\w-]+/g, (m0: string) => {
					if (this.scopedClassNameSet!.has(m0)) {
						return m0 + '__' + this.scopeName
					}
					else {
						return m0
					}
				})

				return name + '=' + value
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
function cloneParseResult(sharedResult: SharedParseReulst, el: HTMLElement | null): ParseResult {
	let {template, places, hasSlots, attributes} = sharedResult
	let fragment = template.content.cloneNode(true) as DocumentFragment
	let nodesInPlaces: Node[] = []

	if (places.length > 0) {
		let nodeIndex = 0
		let placeIndex = 0
		let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null)
		let node: Node | null
		let end = false

		if (attributes) {
			if (!el) {
				throw new Error('A context must be provided when rendering `<template>...`')
			}

			while (placeIndex < places.length && places[placeIndex].nodeIndex === 0) {
				nodesInPlaces.push(el)
				placeIndex++
			}
			nodeIndex = 1
			cloneAttributes(el, attributes)
		}

		if (placeIndex < places.length) {
			while (node = walker.nextNode()) {
				while (places[placeIndex].nodeIndex === nodeIndex) {
					nodesInPlaces.push(node)
					placeIndex++
					
					if (placeIndex === places.length) {
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
	}

	return {
		fragment,
		nodesInPlaces,
		places,
		hasSlots,
	}
}

function cloneAttributes(el: HTMLElement, attributes: {name: string, value: string}[]) {
	for (let {name, value} of attributes) {
		if ((name === 'class' || name === 'style') && el.hasAttribute(name)) {
			if (name === 'style') {
				value = (el.getAttribute(name) as string) + '; ' + value
			}
			else if (name === 'class') {
				value = (el.getAttribute(name) as string) + ' ' + value
			}
		}

		el.setAttribute(name, value)
	}
}