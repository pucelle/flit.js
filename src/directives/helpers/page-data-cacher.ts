import {repeatForTimes} from '../../helpers/utils'


/** Page data getter API. */
export type PageDataGetter<T> = (start: number, size: number) => Promise<Iterable<T>> | Iterable<T>

/** Each page of chace. */
export interface CacheItem<T> {

	/** Items in the page. */
	items: (T | null)[]

	/** Is cache fresh. */
	fresh: boolean
}


export class PageDataCacher<T> {

	private readonly pageSize: number
	private readonly dataGetter: PageDataGetter<T>

	private cache: Map<number, CacheItem<T>> = new Map()
	private requests: Map<number, Promise<void>> = new Map()

	constructor(pageSize: number, dataGetter: PageDataGetter<T>) {
		this.pageSize = pageSize
		this.dataGetter = dataGetter
	}

	/** Get data items immediately. */
	getExistingData(startIndex: number, endIndex: number): CacheItem<T> {
		let startPageIndex = Math.floor(startIndex / this.pageSize)		// 49 -> 0, 50 -> 1
		let endPageIndex = Math.floor((endIndex - 1) / this.pageSize)	// 50 -> 0, 51 -> 1
		let items: (T | null)[] = []
		let fresh = true

		for (let i = startPageIndex; i <= endPageIndex; i++) {
			let cacheItems = this.cache.get(i)
			let pageItems = cacheItems?.items
			
			if (!pageItems) {
				pageItems = repeatForTimes(null, this.pageSize)
				fresh = false
			}

			if (!cacheItems?.fresh) {
				fresh = false
			}

			if (i === startPageIndex && i === endPageIndex) {
				items.push(...pageItems.slice(startIndex - startPageIndex * this.pageSize, endIndex - endPageIndex * this.pageSize))
			}
			else if (i === startPageIndex) {
				items.push(...pageItems.slice(startIndex - startPageIndex * this.pageSize))
			}
			else if (i === endPageIndex) {
				items.push(...pageItems.slice(0, endIndex - endPageIndex * this.pageSize))
			}
			else {
				items.push(...pageItems)
			}
		}

		fresh = fresh || items.some(item => item === null)

		return {items, fresh}
	}

	/** Get fresh data items. */
	async getFreshData(startIndex: number, endIndex: number): Promise<T[]> {
		let startPageIndex = Math.floor(startIndex / this.pageSize)		// 49 -> 0, 50 -> 1
		let endPageIndex = Math.floor((endIndex - 1) / this.pageSize)	// 50 -> 0, 51 -> 1
		let promises: Promise<void>[] = []

		for (let i = startPageIndex; i <= endPageIndex; i++) {
			let cacheItem = this.cache.get(i)
			if (!cacheItem || !cacheItem.fresh) {
				promises.push(this.loadPageData(i))
			}
		}

		await Promise.all(promises)
		return this.getExistingData(startIndex, endIndex).items as T[]
	}

	/** Load  page data in specified index. */
	private loadPageData(pageIndex: number): Promise<void> {
		
		// It's very often that you load one page of data, and then still load this page after scrolled.
		// So we need to cache requests for pages before it returned.
		if (this.requests.has(pageIndex)) {
			return this.requests.get(pageIndex)!
		}

		let requestPromise = this.dataGetter(pageIndex * this.pageSize, this.pageSize)

		if (requestPromise instanceof Promise) {
			let promise = requestPromise.then(items => {
				let fresh = this.requests.has(pageIndex)

				this.cache.set(pageIndex, {
					items: [...items],
					fresh,
				})

				this.requests.delete(pageIndex)
			})

			this.requests.set(pageIndex, promise)

			return promise
		}
		else {
			this.cache.set(pageIndex, {
				items: [...requestPromise],
				fresh: true
			})

			return Promise.resolve()
		}
	}

	/** Moves data after insert or delete at specified index. */
	moveData(index: number, moveCount: number) {
		if (moveCount === 0) {
			return
		}

		let startPageIndex = Math.floor(index / this.pageSize)
		let endPageIndex = Math.floor((index + moveCount) / this.pageSize)

		if (startPageIndex > endPageIndex) {
			[startPageIndex, endPageIndex] = [endPageIndex, startPageIndex]
		}

		let maxPageIndex = Math.max(...this.cache.keys())
		let maxIndex = this.cache.get(maxPageIndex)!.items.length + maxPageIndex * this.pageSize
		let maxNewIndex = maxIndex + moveCount
		let maxNewPageIndex = Math.ceil(maxNewIndex / this.pageSize)

		// Moves right, get each from a left position.
		if (moveCount > 0) {
			for (let pageIndex = maxNewPageIndex; pageIndex > endPageIndex; pageIndex--) {
				let startIndex = pageIndex * this.pageSize
				let endIndex = pageIndex * this.pageSize + this.pageSize

				startIndex -= moveCount
				endIndex -= moveCount

				this.makeNewCacheItem(pageIndex, startIndex, endIndex)
			}
		}

		// Moves left, get each from a right position.
		else {
			for (let pageIndex = endPageIndex + 1; pageIndex <= maxNewPageIndex; pageIndex++) {
				let startIndex = pageIndex * this.pageSize
				let endIndex = pageIndex * this.pageSize + this.pageSize

				startIndex -= moveCount
				endIndex -= moveCount

				this.makeNewCacheItem(pageIndex, startIndex, endIndex)
			}
		}

		// Removes the affected pages.
		for (let pageIndex = startPageIndex; pageIndex <= endPageIndex; pageIndex++) {
			this.cache.delete(pageIndex)
		}

		// Removes the rest pages.
		for (let pageIndex = maxNewPageIndex + 1; pageIndex <= maxPageIndex; pageIndex++) {
			this.cache.delete(pageIndex)
		}

		// Removes the requests that affected.
		for (let pageIndex of [...this.requests.keys()]) {
			if (pageIndex >= startPageIndex) {
				this.requests.delete(pageIndex)
			}
		}
	}

	// Will copy values whose index less than `moveStartIndex` to the generated items.
	// The value whose index less than `nullStartIndex` will be set by `null`.
	private makeNewCacheItem(pageIndex: number, startIndex: number, endIndex: number) {
		let data = this.getExistingData(startIndex, endIndex)
		let hasAnyItem = data.items.some(item => item !== null)

		if (hasAnyItem) {
			this.cache.set(pageIndex, data)
			return true
		}

		return false
	}

	/** 
	 * Make all the cache stale.
	 * Compare with clearing all the cache, it can keep showing old results before reloading them.
	 */
	makeStale() {
		for (let cacheItem of Object.values(this.cache)) {
			cacheItem.fresh = false
		}
	}
	
	/** Clear all data cache. */
	clear() {
		this.cache = new Map()
	}
}