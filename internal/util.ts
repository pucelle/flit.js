export function trim(text: string) {
	return text.replace(/^[\r\n\t]+|[\r\n\t]+$/g, '')
}


export function cloneAttributes(el: Element, attributes: {name: string, value: string}[]) {
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


/**
 * Find the closest index in a sorted array in where to insert new item.
 * Returned index betweens `0 - array.length`, and if `array[index]` exist, `fn(array[index]) >= 0`.
 * @param array The sorted array.
 * @param fn The function to accept item in array as argument and returns `-1` to move left, `1` to move right.
 */
export function binaryFindIndexToInsert<Item>(array: Item[], fn: (item: Item) => (0 | -1 | 1)): number {
	if (array.length === 0) {
		return 0
	}

	let result = fn(array[0])
	if (result === 0 || result === -1) {
		return 0
	}
	if (array.length === 1) {
		return 1
	}

	result = fn(array[array.length - 1])
	if (result === 0) {
		return array.length - 1
	}
	if (result === 1) {
		return array.length
	}

	let start = 0
	let end = array.length - 1

	while (end - start > 1) {
		let center = Math.floor((end + start) / 2)
		let result = fn(array[center])

		if (result === 0) {
			return center
		}
		else if (result === -1) {
			end = center
		}
		else {
			start = center
		}
	}

	return end
}


export function repeatValue<T>(value: T, count: number): T[] {
	let values: T[] = []
	for (let i = 0; i < count; i++) {
		values.push(value)
	}
	return values
}