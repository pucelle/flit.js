// Reference to: Book <<Algorithms Design Techniques and Analysis>> - M.H.Alsuwaiyel, Chapter 4.


/** 
 * Minimum heap construct, can easily add or remove new items, and get minimum item.
 * Otherwise, it allocates very few memory when each time adding or removing.
 */
export class MiniHeap<T> {
	
	/** To compare two items, returns `-1` if `a < b`. */
	private comparer: (a: T, b: T) => number

	/** Data array, caches the complete binary tree. */
	private array: T[] = []

	constructor(comparer: (a: T, b: T) => number) {
		this.comparer = comparer
	}

	/** Whether heap is empty. */
	isEmpty() {
		return this.array.length === 0
	}

	/** Add new `value` to heap. */
	add(value: T) {
		this.array.push(value)
		this.shiftUp(this.array.length - 1)
	}

	/** Removes minimum value, returns it. */
	removeHead(): T | undefined {
		if (this.array.length === 0) {
			return undefined
		}

		if (this.array.length === 1) {
			return this.array.pop()
		}

		let firstValue = this.array[0]
		this.array[0] = this.array.pop()!
		this.shiftDown(0)

		return firstValue
	}

	/** Swap value with parent if needed. */
	shiftUp(index: number) {
		if (index === 0) {
			return
		}

		// If index is 1-based, this value is `index >> 1`.
		let parentIndex = ((index + 1) >> 1) - 1

		// value in index is smaller, should moves up.
		if (this.comparer(this.array[index], this.array[parentIndex]) < 0) {
			this.swap(index, parentIndex)

			// May still need to swap if here it swapped.
			this.shiftUp(parentIndex)
		}
	}

	/** Swap value with one child if needed. */
	shiftDown(index: number) {
		// If index is 1-based, `leftIndex` is `index << 1`.
		let rightIndex = (index + 1) << 1
		let leftIndex = rightIndex - 1
		let childIndex = leftIndex

		// If right value is smaller, moves it up.
		if (rightIndex < this.array.length && this.comparer(this.array[leftIndex], this.array[rightIndex]) > 0) {
			childIndex = rightIndex
		}

		if (childIndex >= this.array.length) {
			return
		}

		// value in child index is smaller, should moves up.
		if (this.comparer(this.array[childIndex], this.array[index]) < 0) {
			this.swap(childIndex, index)

			// May still need to swap if here it swapped.
			this.shiftDown(childIndex)
		}
	}

	/** Swap values of two indices. */
	private swap(i: number, j: number) {
		let vi = this.array[i]
		this.array[i] = this.array[j]
		this.array[j] = vi
	}

	/** Clear all heap data. */
	clear() {
		this.array = []
	}
}