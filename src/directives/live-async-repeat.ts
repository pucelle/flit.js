import {defineDirective, DirectiveResult} from './define'
import {ContextualTransitionOptions} from '../internals/contextual-transition'
import {TemplateResult} from '../template'
import {LiveRepeatDirective, LiveRepeatOptions} from './live-repeat'
import {TemplateFn} from './helpers/repetitive-template'
import {observe, onRenderComplete} from '@pucelle/flit-basis'
import {ImmediatePageDataGetter, PageDataGetter, AsyncPageDataGetter} from './helpers/page-data-getter'


export interface LiveAsyncRepeatDataOptions<T> {

	/** If specified, we can avoid duplicate items with same key shown in same time. */
	readonly key?: keyof T

	/** Total data count getter. */
	readonly dataCount: number | Promise<number> | (() => (number | Promise<number>))

	/** Page data getter to get data items. */
	readonly asyncDataGetter: AsyncPageDataGetter<T>

	/** Page data getter to get data items immediately, can include `null`. */
	readonly immediateDataGetter?: ImmediatePageDataGetter<T>
}

export interface LiveAsyncRepeatEvents<T> {

	/** 
	 * Trigger after every time live data updated.
	 * Note elements are not rendered yet, if you'd want, just uses `liveDataRendered` event.
	 */
	liveDataUpdated: (liveData: T[], startIndex: number, scrollDirection: 'up' | 'down' | null, fresh: boolean) => void

	/** Trigger after every time live data updated and rendered. */
	liveDataRendered: (liveData: T[], startIndex: number, scrollDirection: 'up' | 'down' | null, fresh: boolean) => void
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

export class LiveAsyncRepeatDirective<T = any> extends LiveRepeatDirective<T, LiveAsyncRepeatEvents<T>> {

	/** If specified, we can avoid duplicate items with same key shown in same time. */
	protected readonly key: keyof T | null = null

	/** Caches loaded data. */
	protected dataCount!: number | Promise<number> | (() => (number | Promise<number>))

	/** Caches loaded data. */
	protected dataGetter!: PageDataGetter<T>

	/** Need to call `updateSliderPosition` after got `knownDataCount`. */
	protected needToUpdateSliderPositionAfterDataCountKnown: boolean = false

	/** Whether will update later. */
	protected willUpdateLater: boolean = false

	/** Whether will update data count later. */
	protected willUpdateDataCountLater: boolean = false

	/** Update version. */
	protected version: number = 0

	patch(dataOptions: any, templateFn: TemplateFn<T>, liveRepeatOptions?: LiveRepeatOptions, transitionOptions?: ContextualTransitionOptions) {
		this.dataCount = dataOptions.dataCount
		this.templateFn = templateFn
		this.options.update(liveRepeatOptions)
		this.transition.updateOptions(transitionOptions)
		this.updatePreRendered()

		if (liveRepeatOptions?.renderCount) {
			this.processor.updateRenderCount(liveRepeatOptions.renderCount)
		}

		let firstTimeUpdate = !this.dataGetter
		if (firstTimeUpdate) {
			this.dataGetter = new PageDataGetter(dataOptions.asyncDataGetter, dataOptions.immediateDataGetter)
			this.getDataCountThenUpdate()
		}
		else if (!this.willUpdateLater) {
			this.update()
		}
	}

	__updateImmediately() {
		if (!this.willUpdateLater) {
			this.processor.updateRendering(this.updateFromIndices.bind(this))
		}
	}

	protected checkCoverage() {
		if (!this.willUpdateLater) {
			super.checkCoverage()
		}
	}

	protected async getDataCountThenUpdate() {
		let dataCountConfig = this.dataCount
		if (!dataCountConfig) {
			return
		}

		if (this.willUpdateDataCountLater) {
			return
		}

		this.willUpdateDataCountLater = true
		this.willUpdateLater = true

		// Wait a little while to see if more update data count requests come.
		await Promise.resolve()

		// If more requests comes when updating it, accept new.
		this.willUpdateDataCountLater = false
		let version = ++ this.version

		let dataCount: number | Promise<number>
		let knownDataCount = 0

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
			knownDataCount = dataCount
		}

		if (version === this.version) {
			this.processor.updateDataCount(knownDataCount)
			this.update()
			this.willUpdateLater = false
		}
	}

	protected updateFromIndices(startIndex: number, endIndex: number, scrollDirection: 'up' | 'down' | null) {
		this.startIndex = startIndex
		this.endIndex = endIndex

		let items = this.dataGetter.getImmediateData(startIndex, endIndex)
		let fresh = !items.some(item => item === null || item === undefined)

		this.updateLiveData(items, scrollDirection)
		this.triggerLiveAsyncDataEvents(scrollDirection, fresh)

		if (!fresh) {
			let updateVersion = ++this.updateVersion

			this.dataGetter.getFreshData(startIndex, endIndex).then((data: T[]) => {
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

	/** 
	 * Reload data count and refresh to get all needed data.
	 * Call this when data order column changed and you want to keep scroll position, e.g., after sorting. */ 
	reload() {
		this.getDataCountThenUpdate()
	}

	/** Resolved until `liveDataUpdated` triggered. */
	untilUpdated() {
		return new Promise(resolve => {
			this.once('liveDataUpdated', () => resolve())
		}) as Promise<void>
	}

	/** Resolved until `liveDataUpdated` triggered with fresh data. */
	untilFreshUpdated(this: LiveAsyncRepeatDirective) {
		return new Promise(resolve => {
			let listener = (_liveData: any, _startIndex: any, _scrollDirection: any, fresh: boolean) => {
				if (fresh) {
					this.off('liveDataUpdated', listener as any)
					resolve()
				}
			}

			this.once('liveDataUpdated', listener as any)
		}) as Promise<void>
	}

	/** Resolved until `liveDataRendered` triggered. */
	untilRendered() {
		return new Promise(resolve => {
			this.once('liveDataRendered', () => resolve())
		}) as Promise<void>
	}

	/** Resolved until `liveDataRendered` triggered with fresh data. */
	untilFreshRendered(this: LiveAsyncRepeatDirective) {
		return new Promise(resolve => {
			let listener = (_liveData: any, _startIndex: any, _scrollDirection: any, fresh: boolean) => {
				if (fresh) {
					this.off('liveDataRendered', listener as any)
					resolve()
				}
			}

			this.once('liveDataRendered', listener as any)
		}) as Promise<void>
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
