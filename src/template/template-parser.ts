import {TemplateType} from './template-result'
import {joinWithOrderedMarkers, containsOrderedMarker, parseOrderedMarkers, splitByOrderedMarkers} from './template-result-operate'
import {getScopedClassNameSet} from '../component'
import {cloneAttributes, trim} from '../internal/util'
import {parseToHTMLTokens, HTMLTokenType} from '../internal/html-token'


export enum PartType {
	Node,
	Attr,
	MayAttr,
	Property,
	Event,
	FixedBinging,
	Binding
}

export interface ParseResult {
	fragment: DocumentFragment
	places: Place[] | null
	nodesInPlaces: Node[] | null
	hasSlots: boolean
}

export interface Place {
	type: PartType
	name: string | null

	// Some holes line ${html``}, it has not strings besides, such that it's strings is `null`.
	strings: string[] | null

	// Some binds like `:ref="name"`, it needs to be initialized but take no place, it's valueIndexes is `null`.
	valueIndexes: number[] | null

	nodeIndex: number
}

export interface SharedParseReulst {
	template: HTMLTemplateElement
	places: Place[]
	hasSlots: boolean
	attributes: {name: string, value: string}[] | null
}

// context name -> template string -> parse result
const parseResultCache: Map<string, Map<string, SharedParseReulst>> = new Map()


/**
 * Parse template strings to an fragment and interlations and their related nodes.
 * Always prepend a comment in the front to mark current template start position.
 * @param type 
 * @param strings 
 */
export function parse(type: TemplateType, strings: TemplateStringsArray | string[], el: HTMLElement | null): ParseResult {
	let scopeName = el ? el.localName : 'global'

	if ((type === 'html' || type === 'svg')) {
		let string = joinWithOrderedMarkers(strings as unknown as string[])
		let sharedResultMap = parseResultCache.get(scopeName)
		let sharedResult = sharedResultMap ? sharedResultMap.get(string) : null

		if (!sharedResult) {
			if (!sharedResultMap) {
				sharedResultMap = new Map()
				parseResultCache.set(scopeName, sharedResultMap)
			}
			sharedResult = new HTMLSVGTemplateParser(type, string, scopeName).parse()
			sharedResultMap.set(string, sharedResult)
		}

		return cloneParseResult(sharedResult, el)
	}
	else if (type === 'css') {
		let html = `<style>${strings[0]}</style>`
		let fragment = createTemplateFromHTML(html).content

		return {
			fragment,
			nodesInPlaces: null,
			places: null,
			hasSlots: false
		}
	}
	else {
		let text = strings[0]
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


class HTMLSVGTemplateParser {

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
		let tokens = parseToHTMLTokens(this.string)
		let codes = ''
		let hasSlots = false

		for (let token of tokens) {
			switch (token.type) {
				case HTMLTokenType.StartTag:
					let tagName = token.tagName!
					let attributes = token.attributes!
		
					if (tagName === 'slot') {
						hasSlots = true
					}

					// ` {flit:0}` be at least 
					if (attributes.length >= 9) {
						attributes = this.parseAttribute(attributes)
					}
		
					codes += '<' + tagName + attributes + '>'
					this.nodeIndex++
					break

				case HTMLTokenType.EndTag:
					codes += `</${token.tagName}>`
					break

				case HTMLTokenType.Text:
					codes += this.parseText(token.text!)
					break
			}
		}

		let firstTag = tokens.find(token => token.type === HTMLTokenType.StartTag)
		let svgWrapped = false

		if (firstTag) {
			if (this.type === 'svg' && firstTag.tagName !== 'svg') {
				codes = '<svg>' + codes + '</svg>'
				svgWrapped = true
			}
		}

		let template = createTemplateFromHTML(codes)
		let attributes: {name: string, value: string}[] | null = null

		if (svgWrapped) {
			let svg = template.content.firstElementChild!
			template.content.append(...svg.childNodes)
			svg.remove()
		}

		// We can define some classes or styles on the top element if renders `<template class="...">`.
		if (firstTag && firstTag.tagName === 'template') {
			template = template.content.firstElementChild as HTMLTemplateElement
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
		// `text` has already been trimmed here when parsing as tokens.
		if (!text) {
			return text
		}

		if (containsOrderedMarker(text)) {
			let {strings, valueIndexes} = splitByOrderedMarkers(text)

			// Each hole may be a string, or a `TemplateResult`, so must unique them, but can't join them to a string.
			for (let i = 1; i < strings.length; i++) {
				this.places.push({
					type: PartType.Node,
					name: null,
					strings: null,
					valueIndexes: valueIndexes.slice(i - 1, i),
					nodeIndex: this.nodeIndex
				})

				this.nodeIndexs.push(this.nodeIndex)
				this.nodeIndex += 1
			}

			text = strings.map(trim).join('<!--->')
		}

		return text
	}

	parseAttribute(attr: string): string {
		const attrRE = /([.:?@\w-]+)\s*(?:=\s*(".*?"|'.*?'|\{flit:\d+\})\s*)?|\{flit:(\d+)\}\s*/g

		return attr.replace(attrRE, (m0, name: string, value: string = '', markerId: string) => {
			if (markerId) {
				this.places.push({
					type: PartType.Binding,
					name: null,
					strings: null,
					valueIndexes: [Number(markerId)],
					nodeIndex: this.nodeIndex
				})

				this.nodeIndexs.push(this.nodeIndex)
				return ''
			}

			let type: PartType | undefined
			let hasMarker = containsOrderedMarker(value)

			switch (name[0]) {
				case '.':
					type = PartType.Property
					break

				case ':':
					type = PartType.FixedBinging
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

			if (type === undefined && hasMarker) {
				// `class=${...}` -> `:class=${...}`, so the class value can be scoped.
				if (name === 'class') {
					type = PartType.FixedBinging
				}
				else {
					type = PartType.Attr
				}
			}

			if (type !== undefined) {
				if (value[0] === '\'' || value[0] === '"') {
					value = value.slice(1, -1)
				}

				if (hasMarker) {
					let {strings, valueIndexes} = parseOrderedMarkers(value)
					this.places.push({
						type,
						name,
						strings,
						valueIndexes,
						nodeIndex: this.nodeIndex
					})
				}
				else {
					this.places.push({
						type,
						name,
						strings: [value],
						valueIndexes: null,
						nodeIndex: this.nodeIndex
					})
				}

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

	if (attributes) {
		if (!el) {
			throw new Error('A context must be provided when rendering `<template>...`')
		}

		cloneAttributes(el, attributes)
	}

	if (places.length > 0) {
		let nodeIndex = 0
		let placeIndex = 0
		let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null)
		let node: Node | null
		let end = false

		if (attributes) {
			while (placeIndex < places.length && places[placeIndex].nodeIndex === 0) {
				nodesInPlaces.push(el!)
				placeIndex++
			}
			nodeIndex = 1
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
