/** Caches `componentName` -> className[]` map. */
const scopedClassNamesMap: Map<string, Set<string>> = new Map()


/** Get set of all scoped class names from defined component name. */
export function getScopedClassNames(scopeName: string): Set<string> | undefined {
	return scopedClassNamesMap.get(scopeName)
}


/** 
 * Parse result returned from `Component.style()` result to standard style codes.
 * And also remembers all class names inside.
 */
export function parseStyleCodes(text: string, scopeName: string): string {
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
	let classNameSet = getClassNameSet(scopeName)
	let keyframesDeep: number = 0

	while (match = re.exec(text)) {
		let spaces = match[1]
		let chars = match[2]
		let endChar = match[3]

		if (endChar === '{' && chars) {
			// Commands likes `@media` must in the out most level.
			if (chars[0] === '@' || keyframesDeep > 0) {
				codes += match[0]

				if (chars.startsWith('@keyframes')) {
					keyframesDeep = 1
				}
				else if (keyframesDeep > 0) {
					keyframesDeep++
				}
			}
			else {
				if (current) {
					stack.push(current)
					codes += '}'
				}

				let names = current = splitNamesAndCombineNesting(chars, current, scopeName)

				if (scopeName) {
					names = current.map(name => scopeClassName(name, scopeName, classNameSet!))
				}

				codes += spaces + names.join(', ') + '{'
			}
		}

		// May also be end paren `@media{...}`, but it's can't be included in any selectors.
		else if (endChar === '}') {
			if (keyframesDeep > 0) {
				keyframesDeep--
			}

			current = stack.pop()

			// Not add `}` for sass like nesting.
			if (!current) {
				codes += match[0]
			}
		}
		else {
			// Skip `/*...*/` and `//...`
			let startChar = match[0][spaces.length]
			if (startChar !== '/') {
				codes += match[0]
			}
		}
	}

	return codes
}


/** Get or create a set caches class names for `scopeName`. */
function getClassNameSet(scopeName: string) {
	if (!scopeName) {
		return null
	}

	// May add more scoped class name when using `render` or `renderAndUpdate`.
	let classNameSet = scopedClassNamesMap.get(scopeName)
	if (!classNameSet) {
		classNameSet = new Set()
		scopedClassNamesMap.set(scopeName, classNameSet)
	}

	return classNameSet
}


/** `a, b` -> `[parent a, parent b]` */
function splitNamesAndCombineNesting(selector: string, current: string[] | undefined, comName: string): string[] {
	let re = /((?:\[.*?\]|\(.*?\)|[\s\S])+?)(?:,|$)/g
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


/** 
 * `a{b{...}}` -> `a b{...}`
 * `a{&-b{...}}` -> a-b{...}`
 */
function combineNestingNames(oldNames: string[], parentNames: string[]): string[] {
	// Has sass reference `&` if match
	let re = /(^|[\s+>~])&/g  // `/(?<=^|[\s+>~])&/g` should be better, but Firefox not support it.

	let names: string[] = []

	for (let oldName of oldNames) {
		if (re.test(oldName)) {
			for (let parentName of parentNames) {
				names.push(oldName.replace(re, '$1' + parentName))
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


/**
 * `p` -> `com-name p`.
 * `:host` -> `com-name`.
 * May be parsed to different style codes in different component.
 */
function scopeTagSelector(name: string, comName: string): string {
	return name.replace(/^(?=\w)/g, comName + ' ')
		.replace(/:host/g, comName)
}
