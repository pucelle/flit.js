import {defineDirective, DirectiveResult, Directive} from './define'
import {DirectiveTransitionOptions, ExcludeProperties} from './shared'
import {TemplateResult} from '../parts'
import {LiveRepeatDirective} from './live-repeat'
import {PageDataGetter, PageDataCacher} from './page-data-cacher'


interface LiveAsyncOptions<Item> {
	pageSize?: number			// Not updatable
	renderPageCount?: number	// Not updatable
	averageItemHeight?: number	// Not updatable
	ref?: (dir: ExcludeProperties<LiveAsyncRepeatDirective<Item>, Directive>) => void	// Not updatable
	dataGetter: PageDataGetter<Item>
	dataCount: number | Promise<number> | (() => (number | Promise<number>))
	key?: keyof Item
}

// Compare to `TempalteFn`, the `item` can accpet `null` as argument when data is still loading.
type LiveTemplateFn<Item> = (item: Item | null, index: number) => TemplateResult


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

export class LiveAsyncRepeatDirective<Item> extends LiveRepeatDirective<Item> {

	private dataCount: number | Promise<number> | (() => (number | Promise<number>)) | null = null

	private key: keyof Item | null = null

	/**
	 * Whole data count when using `dataGetter`.
	 * `-1` means the total count is not determinated yet.
	 * We will try to get the data count value when assigning render options.
	 */
	private knownDataCount: number = -1

	/** Need to call `updateSliderPosition` after got `knownDataCount`. */
	private needToUpdateSliderPositionAfterCountKnown: boolean = false

	private dataCacher!: PageDataCacher<Item>
	private updateId: number = 0

	protected initRenderOptions(options: LiveAsyncOptions<Item> | any) {
		this.dataCacher = new PageDataCacher(this.pageSize)
		this.updateDataOptions(options)
		this.updateDataCount()
	}

	protected updateDataOptions(options: LiveAsyncOptions<Item> | any) {
		this.dataCacher.setDataGetter(options.dataGetter)
		this.dataCount = options.dataCount
	}

	private async updateDataCount() {
		if (!this.dataCount) {
			return
		}

		this.knownDataCount = -1

		let dataCount: number | Promise<number>
		if (typeof this.dataCount === 'function') {
			dataCount = this.dataCount()
		}
		else {
			dataCount = this.dataCount
		}
		
		if (dataCount instanceof Promise) {
			this.knownDataCount = await dataCount
		}
		else {
			this.knownDataCount = dataCount
		}

		if (this.needToUpdateSliderPositionAfterCountKnown) {
			this.updateSliderPosition()
		}
	}

	protected async update() {
		let endIndex = this.limitEndIndex(this.startIndex + this.pageSize * this.renderPageCount)
		let data = this.dataCacher.getExistingData(this.startIndex, endIndex)
		let hasNull = data.some(item => item === null)
		let promise1 = this.updateData(data as Item[])
		let promise2: Promise<void> | undefined
		let updateId = this.updateId += 1

		if (hasNull) {
			promise2 = this.dataCacher.getFreshData(this.startIndex, endIndex).then((data: Item[]) => {
				if (updateId === this.updateId) {
					return this.updateData(data)
				}
				else {
					return Promise.resolve()
				}
			})
		}

		await promise1
		if (promise2) {
			await promise2
		}
	}

	protected async updateData(data: Item[]) {
		if (this.key) {
			data = this.uniqueData(data)
		}

		await super.updateData(data)
	}

	private uniqueData(data: Item[]): Item[] {
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


	// Returns `-1` when total count is not determinated.
	protected getTotalDataCount(): number {
		return this.knownDataCount
	}

	/** When data changed, and you need to keep scroll position. */ 
	async reload() {
		this.dataCacher.clear()
		this.updateDataCount()
		await this.update()
	}

	/** Get currently rendered item in index. */
	getLiveItem(index: number): Item | null {
		let isRendered = index >= this.startIndex && index < this.startIndex + this.data.length
		if (isRendered) {
			return this.data[index - this.startIndex]
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
	options: LiveAsyncOptions<Item>,
	templateFn: LiveTemplateFn<Item>,
	transitionOptions?: DirectiveTransitionOptions
) => DirectiveResult
