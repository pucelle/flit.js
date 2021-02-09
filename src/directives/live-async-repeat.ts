import {defineDirective, DirectiveResult} from './define'
import {ContextualTransitionOptions} from '../internals/contextual-transition'
import {TemplateResult} from '../template'
import {LiveRepeatDirective, LiveRepeatOptions} from './live-repeat'
import {PageDataGetter, PageDataCacher} from './helpers/page-data-cacher'
import {observe} from '../observer'
import {TemplateFn} from './helpers/repeative-template'
import {onRenderComplete} from '../global/queue'


export interface LiveAsyncRepeatDataOptions<T> {

	/** If specified, we can avoid duplicate items with same key shown in same time. */
	key?: keyof T

	/** Page data getter to get each page items. */
	dataGetter: PageDataGetter<T>

	/** Total data count getter. */
	dataCount: number | Promise<number> | (() => (number | Promise<number>))
}


export interface LiveAsyncRepeatEvents<T> {

	/** 
	 * Trigger after every time live data updated.
	 * Note elements are not rendered yet, if you'd want, just uses `liveDataRendered` event.
	 */
	liveDataUpdated: (liveData: T[], startIndex: number, scrollDirection: 'up' | 'down', fresh: boolean) => void

	/** Trigger after every time live data updated and rendered. */
	liveDataRendered: (liveData: T[], startIndex: number, scrollDirection: 'up' | 'down', fresh: boolean) => void
}

/** Compare to `TempalteFn` in `liveRepeat`, it can accpets `null` as parameter when data is still loading. */
export type LiveTemplateFn<T> = (item: T | null, index: number) => TemplateResult


// One issue that is not solved:
// If data changed in backend and cause data duplicating or missing, it's hard to handle handle it.
// Right now we can trigger totally or partially updating from API, if we can detected it.

// Otherwise it's possible to detect data duplicating in frontend by a configuration `key`.
// So we don't show duplicate items for current rendering result.

// What we may do in future?
// When we detected duplicated items, we use them to update old items with same keys, and remove them from current page.
// This will cause we may can't cover current page and need to load more data, but should not frequently.
// And it also cause cached paged data doesn't have fixed size,
// such that we must count size of cached data of each page to fetch the data from `startIndex` to `endIndex`.

export class LiveAsyncRepeatDirective<T> extends LiveRepeatDirective<T, LiveAsyncRepeatEvents<T>> {

	/** If specified, we can avoid duplicate items with same key shown in same time. */
	protected readonly key: keyof T | null = null

	/** Caches loaded data. */
	protected dataCount!: number | Promise<number> | (() => (number | Promise<number>))

	/** Caches loaded data. */
	protected dataCacher!: PageDataCacher<T>

	/** Need to call `updateSliderPosition` after got `knownDataCount`. */
	protected needToUpdateSliderPositionAfterDataCountKnown: boolean = false

	merge(dataOptions: any, templateFn: TemplateFn<T>, liveRepeatOptions?: LiveRepeatOptions, transitionOptions?: ContextualTransitionOptions) {
		this.dataCount = dataOptions.dataCount
		this.templateFn = templateFn
		this.options.update(liveRepeatOptions)
		this.transition.updateOptions(transitionOptions)
		this.updatePreRendered()

		let firstTimeUpdate = !this.dataCacher
		if (firstTimeUpdate) {
			this.dataCacher = new PageDataCacher(dataOptions.key, dataOptions.pageSize)

			this.updateDataCount().then(() => {
				this.update()
			})
		}
		else {
			this.update()
		}
	}

	protected async updateDataCount() {
		let dataCountConfig = this.dataCount
		if (!dataCountConfig) {
			return
		}

		let knownDataCount = 0
		let dataCount: number | Promise<number>

		if (typeof dataCountConfig === 'function') {
			dataCount = dataCountConfig()
		}
		else {
			dataCount = dataCountConfig
		}
		
		if (dataCount instanceof Promise) {
			knownDataCount = await dataCount
		}
		else {
			dataCount = knownDataCount
		}

		this.processor.updateDataCount(knownDataCount)
	}

	protected update() {
		this.processor.updateDataCount(this.fullData.length)
		this.processor.updateAlways(this.updateFromIndices.bind(this))
	}

	protected updateFromIndices(startIndex: number, endIndex: number, scrollDirection: 'up' | 'down' | null) {
		this.startIndex = startIndex
		this.endIndex = endIndex

		let {items, fresh} = this.dataCacher.getExistingData(startIndex, endIndex)
		this.updateLiveData(items, scrollDirection)
		this.triggerLiveAsyncDataEvents(scrollDirection, fresh)

		if (!fresh) {
			let updateVersion = this.updateVersion++

			this.dataCacher.getFreshData(startIndex, endIndex).then((data: T[]) => {
				if (updateVersion === this.updateVersion) {
					this.updateLiveData(data, scrollDirection)
					this.triggerLiveAsyncDataEvents(scrollDirection, true)
				}
			})
		}
	}

	protected updateLiveData(data: (T | null)[], scrollDirection: 'up' | 'down' | null) {
		if (this.key) {
			data = this.uniqueDataByKey(data)
		}

		data = data.map(observe)
		super.updateLiveData(data as T[], scrollDirection)
	}

	protected uniqueDataByKey(data: (T | null)[]): (T | null)[] {
		let set = new Set()
		
		return data.filter(item => {
			if (item) {
				let id = item[this.key!]
				if (set.has(id)) {
					return false
				}
				else {
					set.add(id)
				}
			}

			return true
		})
	}

	protected triggerLiveAsyncDataEvents(scrollDirection: 'up' | 'down' | null, fresh: boolean) {
		this.emit('liveDataUpdated', this.liveData, this.startIndex, scrollDirection, fresh)

		onRenderComplete(() => {
			this.emit('liveDataRendered', this.liveData, this.startIndex, scrollDirection, fresh)
		})
	}

	/** When data ordering changed and you want to keep scroll position, e.g., after sorting by columns. */ 
	reload() {
		this.dataCacher.makeStale()

		this.updateDataCount().then(() => {
			this.update()
		})
	}

	/** 
	 * When data changed completely and you want to move to start scroll position, e.g., after data type changed.
	 * @param index Specified the start index you want to set by `setStartIndex`.
	 */ 
	reset(index: number = 0) {
		this.dataCacher.clear()

		this.updateDataCount().then(() => {
			this.setStartIndex(index)
			this.update()
		})
	}

	/** Resolved until `liveDataUpdated` triggered. */
	untilUpdated() {
		return new Promise(resolve => {
			this.once('liveDataUpdated', () => resolve())
		}) as Promise<void>
	}

	/** Resolved until `liveDataUpdated` triggered with fresh data. */
	untilFreshUpdated() {
		return new Promise(resolve => {
			let listener = (_liveData: any, _startIndex: any, _scrollDirection: any, fresh: boolean) => {
				if (fresh) {
					this.off('liveDataUpdated', listener)
					resolve()
				}
			}

			this.once('liveDataUpdated', listener)
		}) as Promise<void>
	}

	/** Resolved until `liveDataRendered` triggered. */
	untilRendered() {
		return new Promise(resolve => {
			this.once('liveDataRendered', () => resolve())
		}) as Promise<void>
	}

	/** Resolved until `liveDataRendered` triggered with fresh data. */
	untilFreshRendered() {
		return new Promise(resolve => {
			let listener = (_liveData: any, _startIndex: any, _scrollDirection: any, fresh: boolean) => {
				if (fresh) {
					this.off('liveDataRendered', listener)
					resolve()
				}
			}

			this.once('liveDataRendered', listener)
		}) as Promise<void>
	}

	getItem(index: number): T | null {
		return this.dataCacher.getExistingData(index, index + 1).items[0]
	}

	/** Get currently rendered item in index. */
	getRenderedItem(index: number): T | null {
		let isRendered = index >= this.startIndex && index < this.startIndex + this.liveData.length
		if (isRendered) {
			return this.liveData[index - this.startIndex]
		}
		else {
			return null
		}
	}

	/** When async items added at index, we need to adjust scrolling position and data count immediately,
	 * and may add null item as placeholders for the added items.
	 * Such that you will feel no delay after the add or delete operation.
	 * After data loaded, new render result should be the same.
	 */
	notifyAdded(index: number, count: number = 1) {
		this.dataCacher.moveData(index, count)
		this.update()
	}

	notifyDeleted(index: number, count: number = 1) {
		this.dataCacher.moveData(index, -count)
		this.update()
	}
}


/**
 * Gerenate live repeat elements, reuse elements as much as possible when data changed.
 * Compare to `repeat` directive, it will only show partial elements in viewport when you scroll it.
 * @param options Options for live rendering.
 * @param templateFn The fucntion which will return a template from one iterable data and index position.
 * @param transitionOptions The transition options, it can be a transition name, property or properties, or {transition, enterAtStart}.
 */
export const liveAsyncRepeat = defineDirective(LiveAsyncRepeatDirective) as <Item>(
	options: LiveAsyncRepeatDataOptions<Item>,
	templateFn: LiveTemplateFn<Item>,
	liveRepeatOptions?: LiveRepeatOptions,
	transitionOptions?: ContextualTransitionOptions
) => DirectiveResult
