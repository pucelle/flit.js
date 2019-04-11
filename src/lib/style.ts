import {ComponentConstructor, ComponentStyle} from './component'
import {TemplateResult} from './parts'


/** Cache `Component` -> {style element, referenced count} */
const componentStyleTagMap: Map<ComponentConstructor, {style: HTMLStyleElement, count: number}> = new Map()



/** Called when component was connected. */
export function ensureComponentStyle(Com: ComponentConstructor, name: string) {
	if (Com.style) {
		if (componentStyleTagMap.has(Com)) {
			let o = componentStyleTagMap.get(Com)!
			o.count++
		}
		else {
			let styleTag = document.createElement('style')
			styleTag.setAttribute('name', name)
			styleTag.textContent = getStyleContent(Com.style, name)
			document.head.append(styleTag)
			componentStyleTagMap.set(Com, {style: styleTag, count: 1})
		}
	}
}

/** Called when component was disconnected. */
export function mayRemoveStyle(Com: ComponentConstructor) {
	if (componentStyleTagMap.has(Com)) {
		let o = componentStyleTagMap.get(Com)!
		o.count--

		if (o.count === 0) {
			componentStyleTagMap.delete(Com)
		}
	}
}


/** Add global styles */
export function addGlobalStyle(style: ComponentStyle) {
	let styleTag = document.createElement('style')
	styleTag.setAttribute('name', 'global')
	styleTag.textContent = getStyleContent(style, '')
	document.head.append(styleTag)
}

/** Update all styles for components, you can update styles after theme changed. */
export function updateStyles() {
	// `updateStyles` always been called along with `update`,
	// So we may need to makesure update style in the same micro task.
	for (let [Com, {style: styleTag}] of componentStyleTagMap) {
		if (typeof Com.style === 'function') {
			let newContent = getStyleContent(Com.style, styleTag.getAttribute('name')!)
			if (newContent !== styleTag.textContent) {
				styleTag.textContent = newContent
			}
		}
	}
}


/** Get style text from static style property. */
function getStyleContent(style: ComponentStyle, scopeName: string): string {
	if (typeof style === 'function') {
		style = style()
	}

	if (style instanceof TemplateResult) {
		style = style.join()
	}

	return StyleParser.parse(style, scopeName)
}


/** Parse style, remove nesting selectors and scope them. */
namespace StyleParser {

	/** Cache `Component` -> {style element, referenced count} */
	export const scopedClassNameSetMap: Map<string, Set<string>> = new Map()

	export function getScopedClassNameSet(comName: string): Set<string> | undefined {
		return scopedClassNameSetMap.get(comName)
	}

	export function parse(text: string, comName: string): string {
		let re = /(\s*)(?:\/\/.*|\/\*[\s\S]*?\*\/|((?:\(.*?\)|".*?"|'.*?'|[\s\S])*?)([;{}]))/g
			/*
				\s* - match white spaces in left
				(?:
					\/\/.* - match comment line
					|
					\/\*[\s\S]*?\*\/ - match comment seagment
					|
					(?:
						\(.*?\) - (...), sass code may include @include fn(${name})
						".*?" - double quote string
						|
						'.*?' - double quote string
						|
						[\s\S] - others
					)*? - declaration or selector
					([;{}])
				)
			*/
		
		let match: RegExpExecArray | null
		let stack: string[][] = []
		let current: string[] | undefined
		let codes = ''
		let classNameSet: Set<string> | undefined

		if (comName) {
			classNameSet = new Set()
			scopedClassNameSetMap.set(comName, classNameSet)
		}

		while (match = re.exec(text)) {
			let spaces = match[1]
			let chars = match[2]
			let endChar = match[3]

			if (endChar === '{' && chars) {
				// Commands likes `@media` must be in the out mose level.
				if (chars[0] === '@') {
					codes += match[0]
				}
				else {
					if (current) {
						stack.push(current)
						codes += '}'
					}

					current = parseToNames(chars, current, comName, classNameSet)
					codes += spaces + current.join(', ') + '{'
				}
			}

			// May also be end paren `@media{...}`, but it's can't be included in any selectors.
			else if (endChar === '}') {
				current = stack.pop()
				if (!current) {
					codes += match[0]
				}
			}
			else {
				let startTwoChars = match[0].slice(spaces.length, spaces.length + 2)
				if (startTwoChars !== '//' && startTwoChars !== '/*') {
					codes += match[0]
				}
			}
		}

		return codes
	}

	function parseToNames(selector: string, current: string[] | undefined, comName: string, classNameSet: Set<string> | undefined): string[] {
		let re = /((?:\[.*?\]|\(.*?\)|.)+?)(?:,|$)/gs
		/*
			(?:
				\[.*?\] - match [...]
				|
				\(.*?\) - match (...)
				|
				. - match other characters
			)
			+?
			(?:,|$) - if match ',' or '$', end
		*/
		
		let match: RegExpExecArray | null
		let names: string[] = []

		while (match = re.exec(selector)) {
			let name = match[1].trim()
			if (name) {
				if (comName) {
					name = scopeClassName(name, comName, classNameSet!)
				}

				if (!current) {
					name = scopeTagSelector(name, comName)
				}

				names.push(name)
			}
		}

		if (current) {
			names = combineNestingNames(names, current)
		}

		return names
	}	
	
	function combineNestingNames(oldNames: string[], parentNames: string[]): string[] {
		// Has sass reference `&` if match
		let re = /(?<=^|[\s+>~])&/g

		let names: string[] = []

		for (let oldName of oldNames) {
			if (re.test(oldName)) {
				for (let parentName of parentNames) {
					names.push(oldName.replace(re, parentName))
				}
			}
			else {
				for (let parentName of parentNames) {
					names.push(parentName + ' ' + oldName)
				}
			}
		}

		return names
	}

	// Benchmark about nested selector: https://jsperf.com/is-nesting-selector-slower
	// About 2~4% slower for each nested selector when rendering.

	/** `.name` -> `.name__com-name` */
	function scopeClassName(name: string, comName: string, classNameSet: Set<string>): string {
		return name.replace(/\.([\w-]+)/g, (m0: string, name: string) => {
			if (m0.includes('__')) {
				return m0
			}
			else {
				classNameSet.add(name)
				return m0 + '__' + comName
			}
		})
	}

	/** `p` -> `com-name p` */
	function scopeTagSelector(name: string, comName: string): string {
		return name.replace(/^(?=\w)/g, comName + ' ')
			.replace(/:host/g, comName)
	}
}

export const getScopedClassNameSet = StyleParser.getScopedClassNameSet