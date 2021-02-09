import {TwoWayMap} from "./two-way-map"


// We want to reduce times of moving elements, the best way is:
// http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.4.6927&rep=rep1&type=pdf

// But we don't want it complex, and just want a enough way to handle single place inserting or mutiple places removing.
// So just provide very simple a O(N) method.

// Reference to: https://github.com/Polymer/lit-html/blob/master/src/directives/repeat.ts


/** A edit to indicete how to process current item. */
export interface EditRecord {

	/** Current Edit type. */
	type: EditType

	/** Index of the current old item if uses it, or next old item. */
	fromIndex: number

	/** Index of the new item. */
	toIndex: number

	/** Index of the moved item. */
	moveFromIndex: number
}


export enum EditType {

	/** 
	 * Ignores, will be used later as a matched item or reuse it.
	 * Used internal, no need to handle it in your code.
	 */
	Skip,

	/** Leaves because of match. */
	Leave,

	/** Moves same item from it's old index to current index. */
	Move,

	// /** Modify item and not move it, not supported because we don't validate position of reuseable element. */
	// Modify,

	/** Move + Modify. */
	MoveModify,

	/** Insert a new one. */
	Insert,

	/** Delete. */
	Delete,
}


/** Get a edit record from an old indices graph to a new one. */
export function getEditRecord<T>(oldItems: T[], newItems: T[], willReuse: boolean): EditRecord[] {
	if (newItems.length === 0) {
		return oldItems.map((_item, index) => {
			return {
				type: EditType.Delete,
				fromIndex: index,
				toIndex: -1,
				moveFromIndex: -1,
			}
		})
	}
	else if (oldItems.length === 0) {
		return newItems.map((_item, index) => {
				return {
					type: EditType.Insert,
					fromIndex: 0,
					toIndex: index,
					moveFromIndex: -1,
				}
			})
	}
	else {
		return getNormalEditRecord(oldItems, newItems, willReuse)
	}
}


/** 
 * When `oldItems` and `newItems` are both not empty.
 * When `willReuse` is `false`, will never reuse items.
 */
function getNormalEditRecord<T>(oldItems: T[], newItems: T[], willReuse: boolean): EditRecord[] {

	// indexMap: old index <-> new index.
	let {indexMap, restOldIndices} = makeTwoWayIndexMap(oldItems, newItems)

	// All the new index that have an old index map, and order by their order in the `oldItems`.
	let indicesInNew: number[] = []
	for (let oldIndex of indexMap.getAllLeft()) {
		let indexInNew = indexMap.getFromLeft(oldIndex)!
		indicesInNew.push(indexInNew)
	}

	// Get a increased sequence from new indices that have an old index map, so no need move this part.
	let stableNewIndexStack = new ReadonlyStack(findLongestIncreasedSequence(indicesInNew))

	// Count of items that will be reused.
	let restOldIndicesStack = new ReadonlyStack(restOldIndices)

	// Another optimization:
	// After get stable items, some reuseable items between two stable items can be reused without moving.
	// This is good when data is absolutely random, but not help much for normal data.

	let edit: EditRecord[] = []
	let oldIndex = 0
	let newIndex = 0
	let nextStableNewIndex = stableNewIndexStack.getNext()
	let nextStableOldIndex = indexMap.getFromRight(nextStableNewIndex)!

	while (oldIndex < oldItems.length || newIndex < newItems.length) {
		let type: EditType
		let moveFromIndex = -1
		let fromIndex = oldIndex
		let toIndex = newIndex

		// New ended, delete old.
		if (newIndex === newItems.length) {
			type = EditType.Skip
			oldIndex++
		}

		// Old not matches, leaves old to be reused or deletes it.
		else if (oldIndex !== nextStableOldIndex && oldIndex < oldItems.length) {
			type = EditType.Skip
			oldIndex++
		}

		// Old and new matches, skip them all.
		else if (newIndex === nextStableNewIndex) {
			type = EditType.Leave
			oldIndex++
			newIndex++
			nextStableNewIndex = stableNewIndexStack.isEnded() ? -1 : stableNewIndexStack.getNext()
			nextStableOldIndex = nextStableNewIndex === -1 ? -1 : indexMap.getFromRight(nextStableNewIndex)!
		}

		// Moves old to new position.
		else if (indexMap.hasRight(newIndex)) {
			type = EditType.Move
			moveFromIndex = indexMap.getFromRight(newIndex)!
			newIndex++
		}
		
		// Reuses old.
		else if (willReuse && !restOldIndicesStack.isEnded()) {
			type = EditType.MoveModify
			moveFromIndex = restOldIndicesStack.getNext()
			newIndex++
		}

		// Creates new.
		else {
			type = EditType.Insert
			moveFromIndex = -1
			newIndex++
		}

		if (type !== EditType.Skip) {
			edit.push({
				type,
				fromIndex,
				toIndex,
				moveFromIndex,
			})
		}
	}

	// Removes not used items.
	while (!restOldIndicesStack.isEnded()) {
		let fromIndex = restOldIndicesStack.getNext()

		edit.push({
			type: EditType.Delete,
			fromIndex,
			toIndex: -1,
			moveFromIndex: -1,
		})
	}

	return edit
}


/** Create a 2 way index map: old index <-> new index, just like a sql inner join. */
function makeTwoWayIndexMap<T>(oldItems: T[], newItems: T[]) {
	// Have a little problem, will find last match when repeated items exist.
	let newItemIndexMap: Map<T, number> = new Map(newItems.map((item, index) => [item, index]))

	// old index <-> new index.
	let indexMap: TwoWayMap<number, number> = new TwoWayMap()
	let restOldIndices: number[] = []

	for (let i = 0; i < oldItems.length; i++) {
		let oldItem = oldItems[i]

		if (newItemIndexMap.has(oldItem)) {
			indexMap.add(i, newItemIndexMap.get(oldItem)!)

			// Must delete, or will cause error when same item exist.
			newItemIndexMap.delete(oldItem)
		}
		else {
			restOldIndices.push(i)
		}
	}

	return {indexMap, restOldIndices}
}


/** 
 * A simple stack can get next one from start.
 * Can avoid shift or pop operation from an array.
 */
class ReadonlyStack<T> {

	private items: T[]
	private offset: number = 0

	constructor(items: T[]) {
		this.items = items
	}

	isEnded() {
		return this.offset >= this.items.length
	}

	getNext() {
		return this.items[this.offset++]
	}
}


/** 237456 -> 23456 */
function findLongestIncreasedSequence(items: number[]) {
	
	// In the first loop, we try to find each increased sequence.
	// 237456 -> [23, 7, 456]

	let startIndex = 0
	let increasedSequenceIndices: [number, number][] = []

	for (let i = 1; i < items.length; i++) {
		if (items[i] < items[i - 1]) {
			increasedSequenceIndices.push([startIndex, i])
			startIndex = i
		}
	}

	if (startIndex < items.length) {
		increasedSequenceIndices.push([startIndex, items.length])
	}

	// In the second loop, we try to find the longest discreate increased sequence.

	// [23, 7, 456]
	// 23 -> 7 excluded -> 456

	// [2, 78, 456]
	// 2 -> 78 replaced -> 456 replaced

	let longest: number[] = []
	let currentValue = -1

	for (let i = 0; i < increasedSequenceIndices.length; i++) {
		let [start, end] = increasedSequenceIndices[i]

		if (items[start] > currentValue) {
			longest = [...longest, ...items.slice(start, end)]
			currentValue = longest[longest.length - 1]
		}
		else if (end - start > longest.length) {
			longest = items.slice(start, end)
			currentValue = longest[longest.length - 1]
		}
	}

	return longest
}