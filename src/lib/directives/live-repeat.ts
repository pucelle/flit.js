import {defineDirective, DirectiveResult} from './define'
import {Context} from '../component'
import {DirectiveTransitionOptions, WatchedTemplate} from './shared'
import {NodeAnchor} from '../node-helper'
import {on} from '../dom-event'
import {Watcher} from '../watcher'
import {TemplateResult} from '../parts'
import {RepeatDirective} from './repeat'
import {onRenderComplete} from '../queue'
import {binaryFindIndexToInsert, ScrollerClientRect, ThrottleByAnimationFrame, repeatValue} from './helper'


interface LiveDataOptions<Item> {
	groupSize: number
	renderGroupCount?: number
	data: Iterable<Item>
	startIndex?: number
	averageItemHeight?: number
}

interface LiveOptions<Item> {
	groupSize: number
	renderGroupCount?: number
	data?: Iterable<Item>
	dataCount?: number | Promise<number>
	dataGetter?: GroupDataGetter<Item>
	startIndex?: number
	averageItemHeight?: number
}

type GroupDataGetter<Item> = (start: number, size: number) => Promise<Iterable<Item>> | Iterable<Item>

type TemplateFn<Item> = (item: Item, index: number) => TemplateResult

// Compare to `TempalteFn`, the `item` can accpet `null` as argument when data is still loading.
type LiveTemplateFn<Item> = (item: Item | null, index: number) => TemplateResult


// Benchmark: https://jsperf.com/is-absolute-layout-faster

// The `liveRepeat` only support render one item in one line.
// At beginning, we supported rendering several items in one line (works like photo album).
// This required us to listen watch the rect of the `scroller`,
// then to adjust a `cellCount` value which specify how many items in one line.
// This is not hard, but it requires us to support `onReconnected` and `onDisconnected` on directive,
// So that we can unregister or restore the watch for scroller size changes.
// This is a break change and needs us to modify `Component`, `NodePart`, `Template`, `defineDirective`, `Directive`.
// So finally we plan to implement a component to support rendering several items in one line.

// There is still a potential issue here:
// We may can't cover viewport if page was resized,
// until next time rendering, the `renderGroupCount` can be expanded to a bigger value.

// Why not cache requested grouped data in directive?
// It's obviously that there is no exported interface to clear cached data or just clear from a specified index
// since what we have is only a directive and what it output.
// So it's not possible or very hard to update when data is changed.
// We will implement a new `store` API to cache grouped data, and support filtering, sorting, searching on it.

export class LiveRepeatDirective<Item> extends RepeatDirective<Item | null> {

	private dataWatcher: Watcher<Item[]> | null = null

	/** The parent node of `anchorNode`, it will be used as a slider to slide in the scroller element. */
	private slider!: HTMLElement

	/** The parent node of `slider`, it's `overflow` value must be `auto` or `scroll`. */
	private scroller!: HTMLElement

	/**
	* How many items to render each time.
	* If you are using dynamic data, you should set this value to count of items that you ajax interface returned.
	* Otherwise you may set this value big enough to cover viewport, but should not too big to render too much items.
	* Normally 50 would be enough since minimal lineHeight is `24` and `24 * 50 = 1200` can cover most screens.
	* If the render result can't cover the viewport, it will be double until it can and rerender.
	*/
	private groupSize: number = 50

	/**
	* How many groups to render each time.
	* If the render result can't cover viewport, will double this value.
	* Normally you don't need to set this, it's value will be automatically detected.
	* Set this value only if you can makesure `1` is not enough and don't want the rerendering at the beginning.
	*/
	private renderGroupCount: number = 1

	// Only multiple `renderGroupCount` for at most once since it will cause additional relayout.
	private renderGroupCountChecked: boolean = false

	/** Specify whole data or an promise function to get grouped data */
	private data: Item[] | null = null

	/**
	 * Specify whole data count when using async data.
	 * `-1` means the total count is not determinated yet.
	 * We will try to get the data count value when assigning render options.
	 */
	private dataCount: number = -1

	// Doesn't implement a data cacher, because data may changed,
	// but here it's only a simple directive,
	// we have no way to manage the whole life cycle of data.
	private dataGetter: GroupDataGetter<Item> | null = null

	/** `startIndex` can only be set for once from `options`. */
	private startIndexApplied: boolean = false

	/** 
	 * Average item height value, it is used to calculate the position of the `slider`.
	 * It will be detected automatically from the first rendering if was not initialized.
	 */
	private averageItemHeight: number = 0

	/** 
	 * When we scrolled up or down, we don't know about the height of just inserted or removed elements.
	 * So we need this property to specify the element in the index, and keep it's scrolling position by adjusting.
	 */
	private indexToKeepPosition: number = -1
	private lastTopOfKeepPositionElement: number = -1

	constructor(
		anchor: NodeAnchor,
		context: Context,
		options: LiveOptions<Item>,
		templateFn: LiveTemplateFn<Item>,
		transitionOptions?: DirectiveTransitionOptions
	) {
		super(anchor, context, null, templateFn, transitionOptions)

		this.initElements()
		this.setRenderOptions(options)
		this.updateAfterStartIndexPrepared()
	}

	initItems() {}

	private initElements() {
		this.slider = this.anchor.el.parentElement as HTMLElement
		this.scroller = this.slider.parentElement as HTMLElement
		
		if (!this.slider || !this.scroller || this.scroller.children.length !== 1) {
			throw new Error(`"liveRepeat" must be contained by the struct like "
				<div style="overflow: auto | scroll">
					<div>
						\${liveRepeat(...)}
					</div>
				</div>
			"`)
		}

		on(this.scroller, 'scroll.passive', ThrottleByAnimationFrame(this.onScroll.bind(this)))

		onRenderComplete(() => {
			if (!['scroll', 'auto'].includes(getComputedStyle(this.scroller).overflowY!)) {
				console.error(`The "overflow-y" value of "scroller" of "liveRepeat" must be "scroll" or "auto"`)
			}
		})
	}

	private setRenderOptions(options: LiveOptions<Item>) {
		if (options.groupSize <= 0) {
			throw new Error(`"groupSize" value for "liveRepeat" must be greater than 0`)
		}

		if (!options.data && !options.dataGetter) {
			throw new Error(`Either "data" or "groupDataGetter" must be specified in "liveRepeat" options`)
		}

		if (options.data) {
			this.watchData(options.data)
		}
		else {
			this.ensureCanRenderNull()
		}

		if (options.dataCount instanceof Promise) {
			options.dataCount.then((dataCount) => {
				// Here may need to check if current assigned options equals the options in context
				this.dataCount = dataCount
			})

			// Use old value, and replace it later after promise resolved.
			delete options.dataCount
		}

		if (typeof options.startIndex !== 'undefined' && options.startIndex >= 0) {
			if (this.startIndexApplied) {
				delete options.startIndex
			}
		}

		Object.assign(this, options)
	}

	private ensureCanRenderNull() {
		let templateFn = this.templateFn

		try {
			let result = templateFn(null, 0)
			if (!(result instanceof TemplateResult)) {
				throw new Error()
			}
		}
		catch (_err) {
			throw new Error(`The "templateFn" must can render "null" to a template result or string when using async data`)
		}
	}

	private watchData(data: Iterable<Item>) {
		if (this.dataWatcher) {
			this.dataWatcher.disconnect()
		}

		let watchFn = () => {
			return [...data]
		}

		let onUpdate = (data: Item[]) => {
			this.data = data
			this.updateAfterStartIndexPrepared()
		}

		this.dataWatcher = new Watcher(watchFn, onUpdate)
		this.data = this.dataWatcher.value
	}

	canMergeWith(_options: any, templateFn: LiveTemplateFn<Item>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(options: any, _templateFn: LiveTemplateFn<Item>, transitionOptions?: DirectiveTransitionOptions) {
		this.setRenderOptions(options as LiveOptions<Item>)
		this.transition.setOptions(transitionOptions)
		this.updateAfterStartIndexPrepared()
	}

	// The `startIndex` is prepared now.
	private async updateAfterStartIndexPrepared() {
		let endIndex = this.limitEndIndex(this.startIndex + this.groupSize * this.renderGroupCount)

		if (this.data) {
			this.updateLiveItems(this.data.slice(this.startIndex, endIndex))
		}
		else {
			this.updateLiveItems(await this.requestGroupedData(this.startIndex, endIndex))
		}

		if (this.averageItemHeight) {
			this.updateSliderPosition()
		}

		// `renderComplete` is absolutely required,
		// we can makesure that the component are rendered only after inserted into document,
		// but directive may be still in fragment when was initialized using `render`.
		onRenderComplete(() => {
			if (!this.renderGroupCountChecked && this.mayDoubleRenderGroupCount()) {
				this.renderGroupCountChecked = true
				this.updateAfterStartIndexPrepared()
				return
			}

			if (!this.averageItemHeight) {
				this.measureAverageItemHeight()
				this.updateSliderPosition()
			}

			if (this.startIndexApplied) {
				this.adjustScrollPosition()
			}
			else if (this.averageItemHeight){
				this.scroller.scrollTop = this.averageItemHeight * this.startIndex || 0
				this.startIndexApplied = true
			}
		})
	}

	private willUpdateItems: boolean = false
	private toUpdateItems: (Item | null)[] | null = null

	private updateLiveItems(items: (Item | null)[]) {
		// If you use two placeholder elements but not margin to specify the position of `slider`,
		// There will be a big issue:
		// When no child nodes moved in scroller, expecially when rendering placeholder values [null, ...].
		// updating height of placeholder elements will cause `scroller.scrollTop` reset.
		this.toUpdateItems = items

		if (!this.willUpdateItems) {
			Promise.resolve().then(() => {
				this.updateItems(this.toUpdateItems!)
				this.willUpdateItems = false
				this.toUpdateItems = null
			})
			
			this.willUpdateItems = true
		}
	}

	private limitEndIndex(index: number): number {
		let maxCount = this.data ? this.data.length : this.dataCount

		if (maxCount >= 0 && index > maxCount) {
			index = maxCount
		}

		return index
	}

	private requestGroupedData(startIndex: number, endIndex: number): null[] {
		// If can't got all grouped data immediately (at least before micro task queue),
		// we render `null` values as placeholders for not immediately returned data,
		// and replace them after data prepared.
		this.loadGroupedData(startIndex, endIndex)
		return repeatValue(null, endIndex - startIndex)
	}

	private loadGroupedData(startIndex: number, endIndex: number) {
		let startGroupIndex = Math.floor(startIndex / this.groupSize)	//49 -> 0, 50 -> 1
		let endGroupIndex = Math.floor((endIndex - 1) / this.groupSize) + 1	// 50 -> 1, 51 -> 2
		let dataArray: (Item | null)[][] = []

		for (let i = startGroupIndex; i < endGroupIndex; i++) {
			dataArray.push(repeatValue(null, this.groupSize))
		}

		for (let i = startGroupIndex; i < endGroupIndex; i++) {
			let promise = this.loadOneGroupData(i * this.groupSize, this.groupSize)
			promise.then(groupdata => {
				dataArray[i - startGroupIndex] = [...groupdata]

				let data: (Item | null)[] = []
				for (let item of dataArray) {
					data.push(...item)
				}

				data = data.slice(
					startIndex - startGroupIndex * this.groupSize,
					endIndex - startGroupIndex * this.groupSize
				)

				if (startIndex === this.startIndex) {
					this.updateLiveItems(data)
				}
			})
		}
	}
	
	/** Cache grouped data requesting promises by their start index. */
	private dataRequestMap: Map<number, Promise<Iterable<Item>>> = new Map()

	// It's very often that you load one page of data, and then still load this page after scrolled.
	// So we need to cache requests for pages before it returned.
	private async loadOneGroupData(start: number, count: number): Promise<Iterable<Item>> {
		if (this.dataRequestMap.has(start)) {
			return this.dataRequestMap.get(start)!
		}

		let dataGetter = this.dataGetter!
		let promise = dataGetter(start, count)

		if (promise instanceof Promise) {
			this.dataRequestMap.set(start, promise)
			let data = await promise
			this.dataRequestMap.delete(start)
			return data
		}
		else {
			return promise
		}
	}

	private updateSliderPosition() {
		if (!this.averageItemHeight) {
			return
		}

		let countBeforeStart = this.startIndex
		let endIndex = this.limitEndIndex(this.startIndex + this.groupSize * this.renderGroupCount)
		let countAfterEnd = 0

		if (this.data) {
			countAfterEnd = Math.max(0, this.data.length - endIndex)
		}
		else if (this.dataCount) {
			countAfterEnd = Math.max(0, this.dataCount - endIndex)
		}

		this.slider.style.marginTop = this.averageItemHeight * countBeforeStart + 'px'
		this.slider.style.marginBottom = this.averageItemHeight * countAfterEnd + 'px'
	}

	private measureAverageItemHeight() {
		if (this.items.length === 0) {
			return
		}

		// Here it is not 100% right when `groupSize` is not big enough.
		// Assume that there is only one `30px` height item with `10px` margin,
		// You will got wrong value 50, not right value 40.
		let sliderHeight = this.slider.offsetHeight
		if (sliderHeight <= 0) {
			return
		}

		this.averageItemHeight = Math.round(sliderHeight / this.items.length)
	}

	private mayDoubleRenderGroupCount(): boolean {
		if (!this.averageItemHeight) {
			return false
		}

		let sliderHeight = this.slider.offsetHeight
		let scrollerHeight = this.scroller.clientHeight
		let changed = false

		while (sliderHeight < scrollerHeight) {
			this.renderGroupCount *= 2
			sliderHeight *= 2
			changed = true
		}

		return changed
	}

	private adjustScrollPosition() {
		let oldTop = this.lastTopOfKeepPositionElement

		if (this.indexToKeepPosition !== -1 && oldTop !== -1) {
			let newTop = this.getTopOfKeepPositionElement()
			if (newTop !== undefined) {
				let topDiff = oldTop - newTop
				
				// If all items have same height, `topDiff` will always be `0` or very close to it.
				// Never update `scroller.scrollTop`, it will cause unexpected scrolling,
				// because scroll events works on a `passive` mode.
				if (topDiff !== 0) {
					this.slider.style.marginTop = this.averageItemHeight * this.startIndex + topDiff + 'px'
				}
			}
		}

		// The rendering result may be 'short' and can't cover viewport, so we need to recheck it.
		// It will trigger a new `scroll` event since we just updated placeholder heights.
		// E.g., we scrolled up to trigger `update('up')` and newly rendered items can't cover scroller bottom,
		// The only short is that when scrolled up for a little later, it will trigger another `update('up')`.
	}

	private getTopOfKeepPositionElement(): number | undefined {
		if (this.indexToKeepPosition === -1) {
			return undefined
		}

		let wtem = this.wtems[this.indexToKeepPosition - this.startIndex]
		if (wtem) {
			let el = wtem.template.range.getFirstElement()
			if (el) {
				return this.getTopOfElement(el)
			}
		}

		return undefined
	}

	private getTopOfElement(el: HTMLElement) {
		if (el.offsetParent === this.slider) {
			return el.offsetTop + this.averageItemHeight * this.startIndex
		}
		else {
			return el.offsetTop
		}
	}

	private onScroll() {
		this.checkRenderingRange()
	}

	private checkRenderingRange() {
		let scrollerRect = new ScrollerClientRect(this.scroller)
		let sliderRect = this.slider.getBoundingClientRect()
		
		if (scrollerRect.rect.top < sliderRect.top) {
			this.updateToCover('up')
		}
		else if (scrollerRect.rect.bottom > sliderRect.bottom) {
			this.updateToCover('down')
		}
	}

	// Direction means where we render new items, and also the direction the value of `startIndex` will change to.
	private updateToCover(direction: 'up' | 'down') {
		let endIndex = -1
		let visibleIndex = -1

		if (direction === 'up') {
			endIndex = visibleIndex = this.locateLastVisibleIndex()
		}
		else {
			let startIndex = visibleIndex = this.locateFirstVisibleIndex()
			if (startIndex > -1) {
				endIndex = startIndex + this.groupSize * this.renderGroupCount
			}
		}

		this.indexToKeepPosition = visibleIndex

		// Must get this value here,
		// later we will lost current `startIndex` and can't locate the element.
		// Otherwise cache the element is not work,
		// It may be moved after `updateItems`.
		this.lastTopOfKeepPositionElement = visibleIndex > -1
			? this.getTopOfElement(this.wtems[visibleIndex - this.startIndex].template.range.getFirstElement()!)
			: -1
		
		if (endIndex === -1) {
			if (direction === 'up') {
				endIndex = Math.ceil((this.scroller.scrollTop + this.scroller.clientHeight) / this.averageItemHeight)
			}
			else {
				endIndex = Math.floor(this.scroller.scrollTop / this.averageItemHeight)
						 + this.groupSize * this.renderGroupCount
			}
		}

		endIndex = this.limitEndIndex(endIndex)

		this.startIndex = Math.max(0, endIndex - this.groupSize * this.renderGroupCount)
		this.updateAfterStartIndexPrepared()
	}

	private locateFirstVisibleIndex(): number {
		let scrollerRect = new ScrollerClientRect(this.scroller)

		let index = binaryFindIndexToInsert(this.wtems as WatchedTemplate<Item>[], (wtem) => {
			let firstElement = wtem.template.range.getFirstElement()
			if (firstElement) {
				let rect = firstElement.getBoundingClientRect()
				if (scrollerRect.isRectAbove(rect)) {
					return 1
				}
				else if (scrollerRect.isRectBelow(rect)) {
					return -1
				}
				else {
					return -1
				}
			}
			else {
				return -1
			}
		})

		if (index === this.wtems.length) {
			return -1
		}

		let wtem = this.wtems[index]
		let firstElement = wtem.template.range.getFirstElement()!

		if (scrollerRect.isRectIn(firstElement.getBoundingClientRect())) {
			return this.startIndex + index
		}
		
		return -1
	}

	private locateLastVisibleIndex(): number {
		let scrollerRect = new ScrollerClientRect(this.scroller)

		let index = binaryFindIndexToInsert(this.wtems as WatchedTemplate<Item>[], (wtem) => {
			let firstElement = wtem.template.range.getFirstElement()
			if (firstElement) {
				let rect = firstElement.getBoundingClientRect()
				if (scrollerRect.isRectAbove(rect)) {
					return 1
				}
				else if (scrollerRect.isRectBelow(rect)) {
					return -1
				}
				else {
					return 1
				}
			}
			else {
				return -1
			}
		})

		if (index === this.wtems.length) {
			return -1
		}

		let wtem = this.wtems[index]
		let firstElement = wtem.template.range.getFirstElement()!

		if (scrollerRect.isRectIn(firstElement.getBoundingClientRect())) {
			return this.startIndex + index
		}

		return -1
	}

	remove() {
		for (let wtem of this.wtems) {
			wtem.remove()
		}
	}
}

/**
 * Gerenate live repeat elements, reuse elements as much as possible when data changed.
 * Compare to `repeat` directive, it will only show partial elements in viewport when you scroll it.
 * @param options Options for live rendering.
 * @param templateFn The fucntion which will return a template from one iterable data and index position.
 * @param transitionOptions The transition options, it can be a transition name, property or properties, or {transition, enterAtStart}.
 */
export const liveRepeat = defineDirective(LiveRepeatDirective) as <T, O extends LiveDataOptions<T> | LiveOptions<T>>(
	options: O,
	templateFn: O extends LiveDataOptions<T> ? TemplateFn<T> : LiveTemplateFn<T>,
	transitionOptions?: DirectiveTransitionOptions
) => DirectiveResult

