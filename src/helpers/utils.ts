/** Trim text by removing `\r\n\t`. */
export function trim(text: string) {
	return text.replace(/^[\r\n\t]+|[\r\n\t]+$/g, '')
}


/**
 * Using binary algorithm to find index from a sorted array at where the item match `fn`.
 * @param array The sorted array.
 * @param fn The function to accept item in array as parameter and returns negative value to move left, positive value to move right.
 */
export function binaryFindIndex<T>(array: ArrayLike<T>, fn: (item: T) => number): number {
	if (array.length === 0) {
		return -1
	}

	let result = fn(array[0])
	if (result === 0) {
		return 0
	}
	if (result < 0) {
		return -1
	}

	if (array.length === 1) {
		return -1
	}

	result = fn(array[array.length - 1])
	if (result === 0) {
		return array.length - 1
	}
	if (result > 0) {
		return -1
	}

	let start = 0
	let end = array.length - 1

	while (end - start > 1) {
		let center = Math.floor((end + start) / 2)
		let result = fn(array[center])

		if (result === 0) {
			return center
		}
		else if (result < 0) {
			end = center
		}
		else {
			start = center
		}
	}

	return -1
}


/** Repeat value for count times. */
export function repeatForTimes<T>(value: T, count: number): T[] {
	let values: T[] = []

	for (let i = 0; i < count; i++) {
		values.push(value)
	}

	return values
}


/** Resolves until next frame. */
export function untilNextFrame() {
	return new Promise(resolve => {
		requestAnimationFrame(resolve)
	})
}


/** Resolves until CPU is idle or next frame. */
export function untilIdle() {
	return new Promise(resolve => {
		if (requestIdleCallback) {
			requestIdleCallback(resolve)
		}
		else {
			setTimeout(resolve, 0)
		}
	})
}
