/** A parsed HTML attribute. */
export interface HTMLArrtribute {
	text: string
	name: string | null
	value: string | null
}


/** 
 * Join two attribute strings into one.
 * `class="..."` will be merged.
 * normal `attr="..."` will be replaced.
 * bindings like `:class="..."` will kept both.
 */
export function joinHTMLAttributes(superAttributes: string, assignAttributes: string): string {
	let superAttributeList = parseToHTMLAttributes(superAttributes)
	let assignAttributeList = parseToHTMLAttributes(assignAttributes)
	let joind = joinParsedHTMLAttributes(superAttributeList, assignAttributeList)

	return joind.map(attr => outputParsedAttribute(attr)).join('')
}


/** Parse a html attributes to a attribute list. */
function parseToHTMLAttributes(attributes: string): HTMLArrtribute[] {
	const attrRE = /([.:?@\w-]+)\s*=(\s*(?:".*?"|'.*?'|\S+)?)|\S+/g
	let results: {text: string, name: string | null, value: string | null}[] = []
	let match: RegExpExecArray | null

	while (match = attrRE.exec(attributes)) {
		// Name is only available for normal standardlize html attributes.
		let name = /[\w-]/.test(match[1]) ? match[1] : null
		let value = name && match[2] ? match[2] : null

		results.push({
			text: match[0],
			name,
			value,
		})
	}

	return results
}


/** Parse a html attributes to a list. */
function joinParsedHTMLAttributes(superAttributeList: HTMLArrtribute[], assignAttributeList: HTMLArrtribute[]): HTMLArrtribute[] {
	for (let item of assignAttributeList) {
		if (item.name === 'class' || item.name === 'style') {
			let exist = superAttributeList.find(superAttr => superAttr.name === item.name)
			if (exist) {
				exist.value = joinAttributeValues(exist.value, item.value)
			}
			else {
				superAttributeList.push(item)
			}
		}
		else if (item.name) {
			let exist = superAttributeList.find(superAttr => superAttr.name === item.name)
			if (exist) {
				exist.value = item.value
			}
			else {
				superAttributeList.push(item)
			}
		}
		else {
			superAttributeList.push(item)
		}
	}

	return superAttributeList
}


/** Join two attribute values. */
function joinAttributeValues(superValue: string | null, assignValue: string | null): string | null {
	if (!assignValue) {
		return ''
	}

	if (!superValue) {
		superValue = ''
	}

	if (!/['"]$/.test(superValue)) {
		superValue = '"' + superValue + '"'
	}

	assignValue = assignValue.replace(/^['"]|['"]$/g, '')

	return superValue.slice(0, -1) + ' ' + assignValue + superValue.slice(-1)
}


/** Output one parsed attribute to an attribute string. */
function outputParsedAttribute(attr: HTMLArrtribute) {
	if (attr.name) {
		if (attr.value) {
			return ' ' + attr.name + '=' + attr.value
		}
		else {
			return ' ' + attr.name
		}
	}
	else {
		return ' ' + attr.text
	}
}