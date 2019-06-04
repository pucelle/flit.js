import {repeatValue} from './helper'


export type PageDataGetter<Item> = (start: number, size: number) => Promise<Iterable<Item>> | Iterable<Item>

interface CacheItem<Item> {
	items: (Item | null)[]
	fresh: boolean
}


export class PageDataCacher<Item> {

	private pageSize: number
	private dataGetter!: PageDataGetter<Item>
	private map: {[index: number]: CacheItem<Item>} = {}	// Need to get keys in order, so not use `Map`.
	private requestingMap: Map<number, Promise<void>> = new Map()

	constructor(pageSize: number) {
		this.pageSize = pageSize
	}

	setDataGetter(dataGetter: PageDataGetter<Item>) {
		this.dataGetter = dataGetter
	}

	getExistingData(startIndex: number, endIndex: number) {
		let startPageIndex = Math.floor(startIndex / this.pageSize)	//49 -> 0, 50 -> 1
		let endPageIndex = Math.floor((endIndex - 1) / this.pageSize)	// 50 -> 0, 51 -> 1
		let data: (Item | null)[] = []
		let nullValues: null[] | undefined

		for (let i = startPageIndex; i <= endPageIndex; i++) {
			let cacheItem = this.map[i]
			let items = cacheItem ? cacheItem.items : nullValues || (nullValues = repeatValue(null, this.pageSize))

			if (i === startPageIndex && i === endPageIndex ) {
				data.push(...items.slice(startIndex - startPageIndex * this.pageSize, endIndex - endPageIndex * this.pageSize))
			}
			else if (i === startPageIndex) {
				data.push(...items.slice(startIndex - startPageIndex * this.pageSize))
			}
			else if (i === endPageIndex) {
				data.push(...items.slice(0, endIndex - endPageIndex * this.pageSize))
			}
			else {
				data.push(...items)
			}
		}

		return data
	}

	async getFreshData(startIndex: number, endIndex: number): Promise<Item[]> {
		let startPageIndex = Math.floor(startIndex / this.pageSize)	//49 -> 0, 50 -> 1
		let endPageIndex = Math.floor((endIndex - 1) / this.pageSize)	// 50 -> 0, 51 -> 1
		let promises: Promise<void>[] = []

		for (let i = startPageIndex; i <= endPageIndex; i++) {
			let cacheItem = this.map[i]
			if (!cacheItem || !cacheItem.fresh) {
				promises.push(this.loadPageData(i))
			}
		}

		await Promise.all(promises)
		return this.getExistingData(startIndex, endIndex) as Item[]
	}

	// It's very often that you load one page of data, and then still load this page after scrolled.
	// So we need to cache requests for pages before it returned.
	private loadPageData(pageIndex: number): Promise<void> {
		if (this.requestingMap.has(pageIndex)) {
			return this.requestingMap.get(pageIndex)!
		}

		let itemsPromise = this.dataGetter(pageIndex * this.pageSize, this.pageSize)

		if (itemsPromise instanceof Promise) {
			let promise = itemsPromise.then(items => {
				this.map[pageIndex] = {
					items: [...items],
					fresh: true
				}

				this.requestingMap.delete(pageIndex)
			})

			this.requestingMap.set(pageIndex, promise)

			return promise
		}
		else {
			this.map[pageIndex] = {
				items: [...itemsPromise],
				fresh: true
			}

			return Promise.resolve()
		}
	}

	// `moveRight` can be negative.
	// Not handle tatal count and slicing last page data,
	// which can be handled inside `LiveRepeat` directivve.
	moveData(index: number, moveRight: number) {
		if (moveRight === 0) {
			return
		}

		let pageIndex = Math.floor(index / this.pageSize)
		if (this.map[pageIndex]) {
			if (moveRight > 0) {
				this.moveDataRight(index, moveRight)
			}
			else {
				this.moveDataLeft(index, -moveRight)
			}
		}
	}

	// `count` will never be `0`
	private moveDataRight(index: number, count: number) {
		let pageIndex = Math.floor(index / this.pageSize)
		let keys = Object.keys(this.map).map(Number)
		let lastGeneratedPageIndex = -1
		let unUsedKeys: Set<number> = new Set()

		for (let i = keys.length - 1; i >= 0; i--) {
			let key = keys[i]
			if (key < pageIndex) {
				continue
			}

			unUsedKeys.add(key)

			let leftPageIndex = key + Math.floor(count / this.pageSize)
			let rightPageIndex = key + Math.ceil(count / this.pageSize)

			if (rightPageIndex !== lastGeneratedPageIndex) {
				let rightPageStartIndex = rightPageIndex * this.pageSize - count
				let generated = this.generateNewCacheItem(rightPageIndex, rightPageStartIndex, index, index)
				if (generated) {
					unUsedKeys.delete(rightPageIndex)
				}
			}

			if (leftPageIndex !== rightPageIndex) {
				let leftPageStartIndex = leftPageIndex * this.pageSize - count
				let generated = this.generateNewCacheItem(leftPageIndex, leftPageStartIndex, index, index)
				if (generated) {
					unUsedKeys.delete(leftPageIndex)
				}
			}

			lastGeneratedPageIndex = leftPageIndex
		}

		if (lastGeneratedPageIndex > pageIndex) {
			this.generateNewCacheItem(pageIndex, pageIndex * this.pageSize - count, index, index)
			unUsedKeys.delete(pageIndex)
		}

		for(let key of unUsedKeys) {
			delete this.map[key]
		}
	}

	// The value whose index less than `nullStartIndex` will be set by `null`.
	// Will copy values whose index less than `moveStartIndex` to the generated items.
	private generateNewCacheItem(pageIndex: number, index: number, nullStartIndex: number, moveStartIndex: number): boolean {
		let startPageIndex = Math.floor(moveStartIndex / this.pageSize)

		// Must can generate for `pageIndex = startPageIndex`
		if (index + this.pageSize <= nullStartIndex && pageIndex !== startPageIndex) {
			return false
		}

		let newItems: (Item | null)[]

		if (index < nullStartIndex) {
			newItems = [...repeatValue(null, nullStartIndex - index), ...this.getExistingData(nullStartIndex, index + this.pageSize)]
		}
		else {
			newItems = this.getExistingData(index, index + this.pageSize)
		}

		// If is the first page, move start fix items into new items.
		if (pageIndex === startPageIndex) {
			let indexToSlice = moveStartIndex - startPageIndex * this.pageSize
			newItems = [
				...this.getExistingData(startPageIndex * this.pageSize, moveStartIndex),
				...newItems.slice(indexToSlice)
			]
		}
		
		this.map[pageIndex] = {
			items: newItems,
			fresh: this.hasNoNull(newItems)
		}

		return true
	}

	// `count` > 0
	private moveDataLeft(index: number, count: number) {
		let pageIndex = Math.floor(index / this.pageSize)
		let keys = Object.keys(this.map).map(Number)
		let lastGeneratedPageIndex = -1
		let unUsedKeys: Set<number> = new Set()

		for (let i = 0; i < keys.length; i++) {
			let key = keys[i]
			if (key < pageIndex) {
				continue
			}

			unUsedKeys.add(key)

			let leftPageIndex = key - Math.ceil(count / this.pageSize)
			let rightPageIndex = key - Math.floor(count / this.pageSize)

			if (leftPageIndex >= 0 && leftPageIndex !== lastGeneratedPageIndex) {
				let leftPageStartIndex = leftPageIndex * this.pageSize + count
				let generated = this.generateNewCacheItem(leftPageIndex, leftPageStartIndex, index + count, index)
				if (generated) {
					unUsedKeys.delete(leftPageIndex)
				}
			}

			if (rightPageIndex >= 0 && rightPageIndex !== leftPageIndex) {
				let rightPageStartIndex = rightPageIndex * this.pageSize + count
				let generated = this.generateNewCacheItem(rightPageIndex, rightPageStartIndex, index + count, index)
				if (generated) {
					unUsedKeys.delete(rightPageIndex)
				}
			}

			lastGeneratedPageIndex = rightPageIndex
		}

		for(let key of unUsedKeys) {
			delete this.map[key]
		}
	}

	private hasNoNull(items: (Item | null)[]): boolean {
		return items.every(item => item !== null)
	}

	clear() {
		this.map = {}
	}
}