import {defineDirective, DirectiveResult} from './define'
import {Context} from '../component'
import {DirectiveTransitionOptions} from '../libs/directive-transition'
import {WatchedTemplate, TemplateFn} from '../libs/watched-template'
import {NodeAnchor} from '../libs/node-helper'
import {on} from '../libs/dom-event'
import {globalWatcherGroup} from '../watcher'
import {RepeatDirective} from './repeat'
import {renderComplete, onRenderComplete} from '../queue'
import {binaryFindIndexToInsert, ScrollerClientRect, throttleByAnimationFrame} from '../libs/util'
import {observe} from '../observer'
import {Options} from '../libs/options'


export interface LiveRepeatOptions<T> {
	/**
	* How many items to render each time.
	* If you are using dynamic data, you should set this value to count of items that you ajax interface returned.
	* Otherwise you may set this value big enough to cover viewport, but should not too big to render too much items.
	* Normally 50 would be enough since minimal lineHeight is `24` and `24 * 50 = 1200` can cover most screens.
	* If the render result can't cover the viewport, it will be double until it can and rerender.
	*/
	pageSize: number

	/**
	* How many pages to render each time.
	* If the render result can't cover viewport, will double this value.
	* Normally you don't need to set this, it's value will be automatically detected.
	* Set this value only if you can makesure `1` is not enough and don't want the rerendering at the beginning.
	*/
	renderPageCount?: number

	/** Raw data to only render part of it. */
	data?: Iterable<T> | null

	/** 
	 * We may want to do something with the currently rendered results, link loading screenshots...
	 * If you want `onRendered`, just use `onRenderComplete` in `onUpdated.`
	 */
	onUpdated?: (data: T[], index: number) => void
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

/** @hidden */
export class LiveRepeatDirective<T> extends RepeatDirective<T> {

	/** The parent node of `anchorNode`, it will be used as a slider to slide in the scroller element. */
	protected slider!: HTMLElement

	/** The parent node of `slider`, it's `overflow` value must be `auto` or `scroll`. */
	protected scroller!: HTMLElement

		/** 
	 * Average item height value, it is used to calculate the position of the `slider`.
	 * It will be detected automatically from the first rendering if was not initialized.
	 */
	protected averageItemHeight: number = 0

	protected options: Options<LiveRepeatOptions<T>> = new Options({pageSize: 50})	// > 1080 / 29

	/** 
	 * `startIndex` can only be set for once from `options`.
	 * Otherwise you should call `setStartIndex`, then `needToApplyStartIndex` will be set to true and wait for next rendering.
	 */
	protected needToApplyStartIndex: boolean = false

	/** 
	 * When we scrolled up or down, we don't know about the height of just inserted or removed elements.
	 * But we can keep it's scrolling position by adjusting `top` or `bottom` property of slider element.
	 */
	private continuousScrollDirection: 'up' | 'down' | null = null
	private continuousSliderPosition: number | null = null
	private scrollerBorderTopWidth: number = 0
	private scrollerBorderBottomWidth: number = 0
	private toCompleteRendering: Promise<void> | null = null

	/** Whole data from options. */
	private rawData: T[] | null = null

	constructor(anchor: NodeAnchor, context: Context) {
		super(anchor, context)
		this.initElements()
	}

	private async initElements() {
		this.slider = this.anchor.el.parentElement as HTMLElement
		this.scroller = this.slider.parentElement as HTMLElement

		if (!this.slider || !this.scroller || this.scroller.children.length !== 1) {
			throw new Error(`"liveRepeat" must be contained in the struct like "
				<div style="overflow: auto | scroll; position: relative" title="as a scroll parent">
					<div title="as a scroll slider" style="position: absolute">
						\${liveRepeat(...)}
					</div>
				</div>
			"`)
		}

		on(this.scroller, 'scroll.passive', throttleByAnimationFrame(this.onScroll.bind(this)))
		
		onRenderComplete(() => {
			let computedStyle = getComputedStyle(this.scroller)
			if (!['scroll', 'auto'].includes(computedStyle.overflowY!)) {
				throw `The "overflow-y" value of "scroller" out of "liveRepeat" directive must be "scroll" or "auto"`
			}

			if (computedStyle.position === 'static') {
				throw `The "position" value of "scroller" out of "liveRepeat" directive must not be "static"`
			}

			if (getComputedStyle(this.slider).position !== 'absolute') {
				throw `The "position" value of "slider" out of "liveRepeat" directive must not be "absolute"`
			}

			this.scrollerBorderTopWidth = Number(getComputedStyle(this.scroller).borderTopWidth!.replace('px', '')) || 0
			this.scrollerBorderBottomWidth = Number(getComputedStyle(this.scroller).borderBottomWidth!.replace('px', '')) || 0
		})
	}

	canMergeWith(_options: any, templateFn: TemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(options: any, templateFn: TemplateFn<T>, transitionOptions?: DirectiveTransitionOptions) {
		this.options.update(options)
		this.templateFn = templateFn
		this.transition.updateOptions(transitionOptions)

		if (options.data !== undefined) {
			this.watchRawDataAndUpdate(options.data)
		}
	}

	private watchRawDataAndUpdate(data: Iterable<T> | null) {
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

		let onUpdate = (data: T[]) => {
			this.rawData = data
			this.update()
		}

		this.unwatchData = (this.context || globalWatcherGroup).watchImmediately(watchFn, onUpdate)
	}

	protected async update() {
		this.updateSliderPosition()
		
		let pageSize = this.options.get('pageSize')
		let renderPageCount = this.options.get('renderPageCount')
		let endIndex = this.limitEndIndex(this.startIndex + pageSize * renderPageCount)
		let data = this.rawData ? this.rawData.slice(this.startIndex, endIndex) : []
		this.toCompleteRendering = this.updateData(data)
		await this.toCompleteRendering
		this.toCompleteRendering = null
	}

	protected async updateData(data: T[]) {
		super.updateData(data)

		let onUpdated = this.options.get('onUpdated')
		if (onUpdated) {
			onUpdated(this.data, this.startIndex)
		}

		onRenderComplete(() => {
			if (this.data.length > 0) {
				if (!this.averageItemHeight) {
					this.measureAverageItemHeight()
					this.updateSliderPosition()
				}

				if (this.needToApplyStartIndex && this.averageItemHeight) {
					this.scroller.scrollTop = this.averageItemHeight * this.startIndex || 0
					this.needToApplyStartIndex = false
				}
			}
		})
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
		let pageSize = this.options.get('pageSize')
		let renderPageCount = this.options.get('renderPageCount')
		let countBeforeStart = this.startIndex
		let endIndex = this.limitEndIndex(this.startIndex + pageSize * renderPageCount)
		let countAfterEnd = 0
		let totalCount = this.getTotalDataCount()

		if (totalCount >= 0) {
			countAfterEnd = Math.max(0, totalCount - endIndex)
		}

		let translateY = this.averageItemHeight * countBeforeStart
		if (this.continuousScrollDirection  && countBeforeStart > 0) {
			translateY = this.continuousSliderPosition!
		}

		let marginBottom = this.averageItemHeight * countAfterEnd

		if (this.continuousScrollDirection === 'up' && countBeforeStart > 0) {
			if (translateY < this.averageItemHeight) {
				translateY = this.averageItemHeight
			}

			this.slider.style.top = 'auto'
			this.slider.style.bottom = '-' + this.averageItemHeight * countAfterEnd + 'px'
		}
		else {
			this.slider.style.top = '0'
			this.slider.style.bottom = 'auto'
		}

		this.slider.style.marginBottom = marginBottom + 'px'
		this.slider.style.transform = `translateY(${translateY}px)`
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

	private getElementOfIndex(index: number) {
		let wtem = this.wtems[index - this.startIndex]
		if (wtem) {
			return wtem.template.range.getFirstElement()
		}

		return null
	}

	private async onScroll() {
		if (this.toCompleteRendering) {
			await this.toCompleteRendering
		}
		this.checkRenderedRange()
	}

	private checkRenderedRange() {
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
	private updateToCover(scrollDirection: 'up' | 'down') {
		let pageSize = this.options.get('pageSize')
		let renderPageCount = this.options.get('renderPageCount')
		let startIndex = -1
		let endIndex = -1	// Max value is `rawData.length`, it's a slice index, not true index of data. 
		let visibleIndex = -1

		if (scrollDirection === 'up') {
			visibleIndex = this.locateLastVisibleIndex()
			endIndex = visibleIndex > -1 ? visibleIndex + 1 : 0
		}
		else {
			startIndex = visibleIndex = this.locateFirstVisibleIndex()
			if (startIndex > -1) {
				endIndex = startIndex + pageSize * renderPageCount
			}
		}

		// In this situation two rendering have no sharing part
		if (endIndex === -1) {
			if (scrollDirection === 'up') {
				endIndex = Math.ceil((this.scroller.scrollTop + this.scroller.clientHeight) / this.averageItemHeight)
			}
			else {
				endIndex = Math.floor(this.scroller.scrollTop / this.averageItemHeight)
						 + pageSize * renderPageCount
			}
		}

		endIndex = this.limitEndIndex(endIndex)
		startIndex = Math.max(0, endIndex - pageSize * renderPageCount)

		this.validateContinuousScrolling(scrollDirection, startIndex, endIndex)

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

		let visibleIndex = binaryFindIndexToInsert(this.wtems as WatchedTemplate<T>[], (wtem) => {
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

		if (visibleIndex === -1) {
			return -1
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

	private validateContinuousScrolling(scrollDirection: 'up' | 'down', startIndex: number, endIndex: number) {
		let indexToKeepPosition = scrollDirection === 'down' ? startIndex : endIndex
		let isSameScrollDirection = this.continuousScrollDirection === scrollDirection

		let el = this.getElementOfIndex(indexToKeepPosition)
		if (el !== null) {
			this.continuousScrollDirection = scrollDirection
			
			if (scrollDirection === 'down') {
				let position = isSameScrollDirection ? this.continuousSliderPosition! : this.getSliderTopPosition()
				position += el.getBoundingClientRect().top - this.slider.getBoundingClientRect().top
				this.continuousSliderPosition = position
			}
			else {
				let position = isSameScrollDirection ? this.continuousSliderPosition! : this.getSliderBottomPosition()
				position += el.getBoundingClientRect().bottom - this.slider.getBoundingClientRect().bottom
				this.continuousSliderPosition = position
			}
		}
		else {
			this.continuousScrollDirection = null
		}
	}

	private getSliderTopPosition() {
		let scrollerPaddingAreaTop = this.scroller.getBoundingClientRect().top - this.scrollerBorderTopWidth!
		let sliderAreaTop = this.slider.getBoundingClientRect().top

		return sliderAreaTop - scrollerPaddingAreaTop + this.scroller.scrollTop
	}

	private getSliderBottomPosition() {
		let scrollerPaddingAreaBottom = this.scroller.getBoundingClientRect().bottom + this.scrollerBorderBottomWidth
		let sliderAreaBottom = this.slider.getBoundingClientRect().bottom
		
		return sliderAreaBottom - scrollerPaddingAreaBottom + this.scroller.scrollTop
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
		this.continuousScrollDirection = null

		// It doesn't update immediately because `rawData` may changed and will update soon.
		// Need to wait reset `needToApplyStartIndex` in `updateData`.
		await renderComplete()

		if (this.needToApplyStartIndex) {
			await this.update()
		}
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
	getItem(index: number): T | null {
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

