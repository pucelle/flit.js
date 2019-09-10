import {defineDirective, DirectiveResult} from './define'
import {Context} from '../component'
import {DirectiveTransitionOptions} from './libs/directive-transition'
import {WatchedTemplate, TemplateFn} from './libs/watched-template'
import {NodeAnchor} from '../libs/node-helper'
import {on} from '../dom-event'
import {globalWatcherGroup} from '../watcher'
import {RepeatDirective} from './repeat'
import {onRenderComplete} from '../queue'
import {binaryFindIndexToInsert, ScrollerClientRect, throttleByAnimationFrame} from './libs/util'
import {observe} from '../observer'


export interface LiveRepeatOptions<Item> {
	pageSize?: number			// Not updatable
	renderPageCount?: number	// Not updatable
	averageItemHeight?: number	// Not updatable
	ref?: (dir: LiveRepeatDirective<Item>) => void	// Not updatable
	data: Iterable<Item> | null
	onUpdated?: (data: Item[], index: number) => void	// If you want `onRendered`, just using `onRenderComplete` in `onUpdated.`
}

interface PositionToKepp {
	index: number
	lastTop: number
}


// Benchmark about using static layout or absolute layout: https://jsperf.com/is-absolute-layout-faster

// The `liveRepeat` only support render one item in one line.
// At beginning, we supported rendering several items in one line (works like photo album).
// This required us to listen watch the rect of the `scroller`,
// then to adjust a `cellCount` value which specify how many items in one line.
// This is not hard, but it requires us to support `onReconnected` and `onDisconnected` on directive,
// So that we can unregister or restore the watch for scroller size changes.
// This is a break change and needs us to modify `Component`, `NodePart`, `Template`, `defineDirective`, `Directive`.
// So finally we plan to implement a component to support rendering several items in one line.

// There is still a potential issue here:
// We may can't cover viewport if page was resized.

export class LiveRepeatDirective<Item> extends RepeatDirective<Item> {

	/** The parent node of `anchorNode`, it will be used as a slider to slide in the scroller element. */
	protected slider!: HTMLElement

	/** The parent node of `slider`, it's `overflow` value must be `auto` or `scroll`. */
	protected scroller!: HTMLElement

	/**
	* How many items to render each time.
	* If you are using dynamic data, you should set this value to count of items that you ajax interface returned.
	* Otherwise you may set this value big enough to cover viewport, but should not too big to render too much items.
	* Normally 50 would be enough since minimal lineHeight is `24` and `24 * 50 = 1200` can cover most screens.
	* If the render result can't cover the viewport, it will be double until it can and rerender.
	*/
	protected pageSize: number = 50

	/**
	* How many pages to render each time.
	* If the render result can't cover viewport, will double this value.
	* Normally you don't need to set this, it's value will be automatically detected.
	* Set this value only if you can makesure `1` is not enough and don't want the rerendering at the beginning.
	*/
	protected renderPageCount: number = 1

	// Only multiple `renderPageCount` for at most once since it will cause additional relayout.
	protected renderPageCountChecked: boolean = false

	/** 
	 * `startIndex` can only be set for once from `options`.
	 * Otherwise you should call `setStartIndex`, then `needToApplyStartIndex` will be set to true and wait for next rendering.
	 */
	protected needToApplyStartIndex: boolean = false

	/** 
	 * Average item height value, it is used to calculate the position of the `slider`.
	 * It will be detected automatically from the first rendering if was not initialized.
	 */
	protected averageItemHeight: number = 0

	/** 
	 * When we scrolled up or down, we don't know about the height of just inserted or removed elements.
	 * So we need this property to specify the element in the index, and keep it's scrolling position
	 * by adjusting `marginTop` after new date rendered .
	 */
	protected positionToKeep: PositionToKepp | null = null

	/** How many pxs adding to `marginTop` currently. */
	protected lastAdjustedTopDiff: number = 0

	/** We may want to do something with the currently rendered results, link loading screenshots... */
	protected onUpdated: ((data: Item[], index: number) => void) | null = null

	/** Whole data from options. */
	private rawData: Item[] | null = null

	constructor(anchor: NodeAnchor, context: Context) {
		super(anchor, context)
		this.initElements()
	}

	private initElements() {
		this.slider = this.anchor.el.parentElement as HTMLElement
		this.scroller = this.slider.parentElement as HTMLElement
		
		if (!this.slider || !this.scroller || this.scroller.children.length !== 1) {
			throw new Error(`"liveRepeat" must be contained in the struct like "
				<div style="overflow: auto | scroll" title="as a scroll parent">
					<div title="as a scroll slider">
						\${liveRepeat(...)}
					</div>
				</div>
			"`)
		}

		on(this.scroller, 'scroll.passive', throttleByAnimationFrame(this.onScroll.bind(this)))

		onRenderComplete(() => {
			if (!['scroll', 'auto'].includes(getComputedStyle(this.scroller).overflowY!)) {
				console.error(`The "overflow-y" value of "scroller" out of "liveRepeat" directive must be "scroll" or "auto"`)
			}
		})
	}

	canMergeWith(_options: any, templateFn: TemplateFn<Item>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(options: any, templateFn: TemplateFn<Item>, transitionOptions?: DirectiveTransitionOptions) {
		if (this.firstlyMerge) {
			this.initRenderOptions(options)
			this.validateTemplateFn(templateFn)

			if (options.ref) {
				options.ref(this)
			}
		}

		this.templateFn = templateFn
		this.transition.setOptions(transitionOptions)
		this.updateRenderOptions(options as LiveRepeatOptions<Item>)
		this.firstlyMerge = false
	}

	protected validateTemplateFn(_templateFn: TemplateFn<Item>) {}

	protected initRenderOptions(options: LiveRepeatOptions<Item>) {
		if (options.pageSize !== undefined && options.pageSize > 0) {
			this.pageSize = options.pageSize
		}

		if (options.renderPageCount) {
			this.renderPageCount = options.renderPageCount
		}

		if (options.averageItemHeight) {
			this.averageItemHeight = options.averageItemHeight
		}
	}

	// Only `data` is updatable
	protected updateRenderOptions(options: LiveRepeatOptions<Item>) {
		if (options.averageItemHeight) {
			this.averageItemHeight = options.averageItemHeight
		}
		
		if (options.onUpdated) {
			this.onUpdated = options.onUpdated
		}

		if (options.data !== undefined) {
			this.watchRawDataAndUpdateImmediately(options.data)
		}
	}

	private watchRawDataAndUpdateImmediately(data: Iterable<Item> | null) {
		if (this.unwatchData) {
			this.unwatchData()
			this.unwatchData = null
		}

		if (!data) {
			this.rawData = []
			return
		}

		let watchFn = () => {
			return [...data].map(observe)
		}

		let onUpdate = (data: Item[]) => {
			this.rawData = data
			this.update()
		}

		this.unwatchData = (this.context || globalWatcherGroup).watchImmediately(watchFn, onUpdate)
	}

	protected async update() {
		this.updateSliderPosition()

		let endIndex = this.limitEndIndex(this.startIndex + this.pageSize * this.renderPageCount)
		let data = this.rawData ? this.rawData.slice(this.startIndex, endIndex) : []
		await this.updateData(data)
	}

	protected async updateData(data: Item[]) {
		super.updateData(data)

		// `onRenderComplete` is absolutely required,
		// we can makesure that the component are rendered only after inserted into document,
		// but directive may be still in fragment when was initialized using `render`.
		onRenderComplete(() => {
			if (data.length > 0) {
				if (!this.renderPageCountChecked && this.mayDoubleRenderPageCount()) {
					this.update()
					return
				}

				if (!this.averageItemHeight) {
					this.measureAverageItemHeight()
					this.updateSliderPosition()
				}

				if (this.needToApplyStartIndex && this.averageItemHeight) {
					this.scroller.scrollTop = this.averageItemHeight * this.startIndex || 0
					this.needToApplyStartIndex = false
				}
				else {
					this.adjustScrollPosition()
				}
			}
		})

		if (this.onUpdated) {
			this.onUpdated(this.data, this.startIndex)
		}
	}

	protected limitEndIndex(index: number): number {
		let maxCount = this.getTotalDataCount()
		if (maxCount >= 0 && index > maxCount) {
			index = maxCount
		}

		return index
	}

	protected getTotalDataCount(): number {
		if (this.rawData) {
			return this.rawData.length
		}
		else {
			return 0
		}
	}

	// If you use two placeholder elements but not top and bottom margin to specify the position of `slider`,
	// There will be a big issue:
	// When no child nodes moved in scroller, expecially when rendering placeholder values [null, ...].
	// updating height of placeholder elements will cause `scroller.scrollTop` reset.
	protected updateSliderPosition() {
		if (!this.averageItemHeight) {
			return
		}

		let countBeforeStart = this.startIndex
		let endIndex = this.limitEndIndex(this.startIndex + this.pageSize * this.renderPageCount)
		let countAfterEnd = 0
		let totalCount = this.getTotalDataCount()

		if (totalCount >= 0) {
			countAfterEnd = Math.max(0, totalCount - endIndex)
		}

		this.slider.style.marginTop = this.averageItemHeight * countBeforeStart + this.lastAdjustedTopDiff + 'px'
		this.slider.style.marginBottom = this.averageItemHeight * countAfterEnd + 'px'
	}

	private measureAverageItemHeight() {
		if (this.data.length === 0) {
			return
		}

		// Here it is not 100% right when `pageSize` is not big enough.
		// Assume that there is only one `30px` height item with `10px` margin,
		// You will got wrong value 50, not right value 40.
		let sliderHeight = this.slider.offsetHeight
		if (sliderHeight <= 0) {
			return
		}

		this.averageItemHeight = Math.round(sliderHeight / this.data.length)
	}

	private mayDoubleRenderPageCount(): boolean {
		if (!this.averageItemHeight) {
			return false
		}

		if (this.data.length === 0) {
			return false
		}

		let sliderHeightAfterFullyRendered = this.slider.offsetHeight / this.data.length * this.pageSize
		let scrollerHeight = this.scroller.clientHeight
		let changed = false

		if (sliderHeightAfterFullyRendered === 0) {
			return false
		}

		while (sliderHeightAfterFullyRendered < scrollerHeight) {
			this.renderPageCount *= 2
			sliderHeightAfterFullyRendered *= 2
			changed = true
		}

		this.renderPageCountChecked = true

		return changed
	}

	private adjustScrollPosition() {
		if (this.positionToKeep) {
			let oldTop = this.positionToKeep.lastTop
			let newTop = this.getElementTopOfIndex(this.positionToKeep.index)
			if (newTop > -1) {
				let topDiffAfterAdjust = oldTop - newTop
				
				// If all items have same height, and `averageItemHeight` was right setted,
				// `topDiff` will always be `0` or very close to it.

				// But if this now match, we need to adjust scroll position to make it seems
				// `scrolling smoothly` - no flushing of any elements.

				// Not never update `scroller.scrollTop`, it will cause unexpected scrolling
				// since scroll events works on a `passive` mode.
				if (Math.abs(topDiffAfterAdjust) > 10) {
					let topDiffToAdjust = this.lastAdjustedTopDiff + topDiffAfterAdjust
					this.lastAdjustedTopDiff = topDiffToAdjust
					this.slider.style.marginTop = this.averageItemHeight * this.startIndex + topDiffToAdjust + 'px'
				}
			}

			this.positionToKeep = null
		}

		// The rendering result may be 'short' and can't cover viewport, so we need to recheck it.
		// Here if we adjusted `marginTop`, it will trigger a new `scroll` event and then trigger another `updateToCover`.
	}

	private getElementTopOfIndex(index: number): number {
		let wtem = this.wtems[index - this.startIndex]
		if (wtem) {
			let el = wtem.template.range.getFirstElement()
			if (el) {
				// slider can move, we need to relative to a not always move element
				if (el.offsetParent === this.slider) {
					return el.offsetTop + this.slider.offsetTop
				}
				else {
					return el.offsetTop
				}
			}
		}

		return -1
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

	// `direction` means where we render new items, and also the direction that the value of `startIndex` will change to.
	private updateToCover(direction: 'up' | 'down') {
		let startIndex = -1
		let endIndex = -1	// Max value is `rawData.length`, it's a slice index, not true index of data. 
		let visibleIndex = -1

		if (direction === 'up') {
			visibleIndex = this.locateLastVisibleIndex()
			endIndex = visibleIndex > -1 ? visibleIndex + 1 : 0
		}
		else {
			startIndex = visibleIndex = this.locateFirstVisibleIndex()
			if (startIndex > -1) {
				endIndex = startIndex + this.pageSize * this.renderPageCount
			}
		}

		// In this situation two rendering have no sharing part
		if (endIndex === -1) {
			if (direction === 'up') {
				endIndex = Math.ceil((this.scroller.scrollTop + this.scroller.clientHeight) / this.averageItemHeight)
			}
			else {
				endIndex = Math.floor(this.scroller.scrollTop / this.averageItemHeight)
						 + this.pageSize * this.renderPageCount
			}
		}

		endIndex = this.limitEndIndex(endIndex)
		startIndex = Math.max(0, endIndex - this.pageSize * this.renderPageCount)

		// If `startIndex` is 0, no need adjust anything.
		if (startIndex === 0) {
			this.lastAdjustedTopDiff = 0
		}
		else if (visibleIndex >= startIndex && visibleIndex < endIndex) {
			// Must get `positionToKeep` here,
			// later we will lost current `startIndex` and can't locate the element in `visibleIndex`.
			// Otherwise cache the visible element is not working,
			// It may be moved after `updateItems` since we will reuse item.
			this.positionToKeep = {
				index: visibleIndex,
				lastTop: this.getElementTopOfIndex(visibleIndex)
			}
		}

		this.startIndex = startIndex
		this.update()
	}

	private locateFirstVisibleIndex(): number {
		return this.locateVisibleIndex(true)
	}

	private locateLastVisibleIndex(): number {
		return this.locateVisibleIndex(false)
	}

	private locateVisibleIndex(isFirst: boolean): number {
		let scrollerRect = new ScrollerClientRect(this.scroller)

		let visibleIndex = binaryFindIndexToInsert(this.wtems as WatchedTemplate<Item>[], (wtem) => {
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
					return isFirst ? -1 : 1
				}
			}
			else {
				return -1
			}
		})

		if (visibleIndex === this.data.length) {
			visibleIndex -= 1
		}

		let firstElement = this.wtems[visibleIndex].template.range.getFirstElement()!
		let firstElementRect = firstElement.getBoundingClientRect()

		// The found index is just an enge index, may the element still outside the visible range.
		if (scrollerRect.isRectAbove(firstElementRect)) {
			visibleIndex += 1
		}
		else if (scrollerRect.isRectBelow(firstElementRect)) {
			visibleIndex -= 1
		}

		if (visibleIndex >= 0 && visibleIndex < this.data.length) {
			return this.startIndex + visibleIndex
		}

		return -1
	}

	remove() {
		for (let wtem of this.wtems) {
			wtem.remove()
		}
	}

	/** Get `startIndex` property. */
	getStartIndex() {
		return this.startIndex
	}

	/** Get the index of the first visible element, which can be used to restore scrolling position by `setStartIndex`. */
	getFirstVisibleIndex() {
		return Math.max(0, this.locateFirstVisibleIndex())
	}

	/** Set `startIndex`, and the item in which index will be at the top start position of the viewport. */
	async setStartIndex(index: number) {
		this.startIndex = this.limitEndIndex(index)
		this.needToApplyStartIndex = true
		await this.update()
	}

	/** Adjust `startIndex` and scroll position to make item in the specified index becomes visible if it's not. */
	async scrollToViewIndex(index: number) {
		// Only adjust scroll position
		if (this.isIndexRendered(index)) {
			this.scrollToViewRenderedIndex(index)
		}
		else {
			if (index < this.startIndex) {
				await this.setStartIndex(index)
			}
			else {
				let startIndex = Math.max(0, (index + 1) - Math.ceil(this.scroller.clientHeight / this.averageItemHeight))
				await this.setStartIndex(startIndex)

				if (this.isIndexRendered(index)) {
					this.scrollToViewRenderedIndex(index)
				}
			}
		}
	}

	private isIndexRendered(index: number) {
		return index >= this.startIndex && index < this.startIndex + this.data.length
	}

	private scrollToViewRenderedIndex(index: number) {
		let el = this.wtems[index - this.startIndex].template.range.getFirstElement()!
		let rect = el.getBoundingClientRect()
		let scrollerRect = new ScrollerClientRect(this.scroller)

		// Below it, need to scroll up
		if (rect.bottom > scrollerRect.rect.bottom) {
			this.scroller.scrollTop = this.scroller.scrollTop + (scrollerRect.rect.bottom - rect.bottom)
		}
		// Above it, need to scroll down
		else if (rect.top < scrollerRect.rect.top) {
			this.scroller.scrollTop = this.scroller.scrollTop + (scrollerRect.rect.top - rect.top)
		}
	}

	/** Get item in index. */
	getItem(index: number): Item | null {
		return this.rawData ? this.rawData[index] || null : null
	}
}

/**
 * Gerenate live repeat elements, reuse elements as much as possible when data changed.
 * Compare to `repeat` directive, it will only show partial elements in viewport when you scroll it.
 * @param options Options for live rendering.
 * @param templateFn The fucntion which will return a template from one iterable data and index position.
 * @param transitionOptions The transition options, it can be a transition name, property or properties, or {transition, enterAtStart}.
 */
export const liveRepeat = defineDirective(LiveRepeatDirective) as <Item>(
	options: LiveRepeatOptions<Item>,
	templateFn: TemplateFn<Item>,
	transitionOptions?: DirectiveTransitionOptions
) => DirectiveResult

