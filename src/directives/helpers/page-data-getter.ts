import {repeatForTimes} from '../../helpers/utils'


/** Page data getter. */
export type AsyncPageDataGetter<T> = (startIndex: number, endIndex: number) => Promise<T[]> | T[]

/** Immediate page data getter. */
export type ImmediatePageDataGetter<T> = (startIndex: number, endIndex: number) => (T | null)[]

/** Data cache. */
export interface PageDataCache<T> {
	startIndex: number
	endIndex: number
	items: T[]
}


export class PageDataGetter<T> {

	private readonly asyncDataGetter: AsyncPageDataGetter<T>
	private readonly immediateDataGetter: ImmediatePageDataGetter<T> | null

	private cache: PageDataCache<T> | null = null
	private version: number = 0

	constructor(asyncDataGetter: AsyncPageDataGetter<T>, immediateDataGetter: ImmediatePageDataGetter<T> | null = null) {
		this.asyncDataGetter = asyncDataGetter
		this.immediateDataGetter = immediateDataGetter
	}

	/** Get data items immediately. */
	getImmediateData(startIndex: number, endIndex: number): (T | null)[] {
		let items: (T | null)[]

		if (this.immediateDataGetter) {
			items = this.immediateDataGetter(startIndex, endIndex)
		}
		else {
			items = this.getSharedData(startIndex, endIndex)
		}

		return items
	}

	/** Get shared part with previously loaded data. */
	private getSharedData(startIndex: number, endIndex: number): (T | null)[] {
		let items: (T | null)[] = []
		let count = endIndex - startIndex

		if (this.cache) {
			if (startIndex < this.cache.startIndex) {
				items.push(...repeatForTimes(null, Math.min(this.cache.startIndex - startIndex, count)))
			}

			// Shared part.
			items.push(...this.cache.items.slice(Math.max(this.cache.startIndex, startIndex), Math.min(this.cache.endIndex, endIndex)))

			if (endIndex > this.cache.endIndex) {
				items.push(...repeatForTimes(null, Math.max(endIndex - this.cache.endIndex, count)))
			}
		}
		else {
			items .push(...repeatForTimes(null, count))
		}

		return items
	}

	/** Get fresh data items. */
	async getFreshData(startIndex: number, endIndex: number): Promise<T[]> {
		let version = ++this.version
		let items = await this.asyncDataGetter(startIndex, endIndex)

		if (this.version === version) {
			this.cache = {
				startIndex,
				endIndex,
				items,
			}
		}

		return items
	}
}