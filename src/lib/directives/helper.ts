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


/** Exclude paddings from `getBoundingClientRect` result. */
export class ScrollerClientRect {

	rect: {-readonly [key in keyof ClientRect]: number}

	constructor(scroller: HTMLElement) {
		let rawRect = scroller.getBoundingClientRect()
		let style = getComputedStyle(scroller)
		let paddingTop = parseFloat(style.paddingTop!) || 0
		let paddingRight = parseFloat(style.paddingRight!) || 0
		let paddingBottom = parseFloat(style.paddingTop!) || 0
		let paddingLeft = parseFloat(style.paddingLeft!) || 0
	
		this.rect = {
			top: rawRect.top + paddingTop,
			right: rawRect.right - paddingRight,
			bottom: rawRect.bottom - paddingBottom,
			left: rawRect.left + paddingLeft,
			width: rawRect.width - paddingLeft - paddingRight,
			height: rawRect.height - paddingTop - paddingBottom
		}
	}

	/** Returns if the element with `rect` is above the scroller. */
	isRectAbove(rect: ClientRect | DOMRect): boolean {
		return rect.bottom <= this.rect.top
	}

	/** Returns if the element with `rect` is below the scroller. */
	isRectBelow(rect: ClientRect | DOMRect): boolean {
		return rect.top >= this.rect.bottom
	}

	/** Returns if the element with `rect` is in scroller or cross with the scroller. */
	isRectIn(rect: ClientRect | DOMRect): boolean {
		return !this.isRectAbove(rect) && !this.isRectBelow(rect)
	}
}


/** Used to throttle scroll event to trigger at most once in each animation frame. */
export function ThrottleByAnimationFrame<F extends (...args: any) => void>(fn: F): F {
	let frameId: number | null = null

	return function(...args: any) {
		if (!frameId) {
			frameId = requestAnimationFrame(() => {
				frameId = null
			})
			fn(...args)
		}
	} as F
}


export function repeatValue<T>(value: T, count: number): T[] {
	let values: T[] = []
	for (let i = 0; i < count; i++) {
		values.push(value)
	}
	return values
}