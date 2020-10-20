import {defineDirective, DirectiveResult} from './define'
import {Context} from '../component'
import {DirectiveTransitionOptions} from '../internal/directive-transition'
import {WatchedTemplate, TemplateFn} from '../internal/watched-template'
import {NodeAnchor} from '../internal/node-helper'
import {on} from '../internal/dom-event'
import {globalWatcherGroup} from '../watcher'
import {RepeatDirective} from './repeat'
import {renderComplete, onRenderComplete} from '../queue'
import {binaryFindIndexToInsert} from '../internal/util'
import {observe} from '../observer'
import {Options} from '../internal/options'


export interface LiveRepeatOptions<T> {
	/** 
	 * If you want it renders from `startIndex` when initialize, set this value.
	 * It works only for first time.
	 */
	startIndex?: number

	/**
	* How many items to render each time.
	* If you are using dynamic data, you should set this value to count of items that you ajax interface returned.
	* Otherwise you may set this value big enough to cover viewport, but should not too big to render too much items.
	* Normally 50 would be enough since minimal lineHeight is `24` and `24 * 50 = 1200` can cover most screens.
	* If the render result can't cover the viewport, it will be double until it can and rerender.
	*/
	pageSize?: number

	/**
	* How many pages to render each time.
	* If the render result can't cover viewport, will double this value.
	* Normally you don't need to set this, it's value will be automatically detected.
	* Set this value only if you can makesure `1` is not enough and don't want the rerendering at the beginning.
	*/
	renderPageCount?: number

	/**
	* When can't render partial contents in an animation frame, you should set this to `true`.
	* It will prerender more templates before and after current partial contents.
	*/
	preRendering?: boolean

	/** Raw data to only render part of it. */
	data?: Iterable<T> | null

	/** 
	 * We may want to do something with the currently rendered results, link loading screenshots...
	 * If you want `onRendered`, just use `onRenderComplete` in `onUpdated.`
	 */
	onUpdated?: (data: T[], index: number) => void
}


const defaultLiveRepeatOptions: LiveRepeatOptions<any> = {
	pageSize: 50,
	renderPageCount: 1,
	preRendering: false,
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

	protected options: Options<LiveRepeatOptions<T>> = new Options(defaultLiveRepeatOptions)	// > 1080 / 29

	/** 
	 * `startIndex` can only be set for once from `options`.
	 * Otherwise you should call `setStartIndex`, then `needToApplyStartIndex` will be set to true and wait for next rendering.
	 */
	protected needToApplyStartIndex: boolean = false

	/** 
	 * When we scrolled up or down, we don't know about the height of just inserted or removed elements.
	 * But we can keep it's scrolling position by adjusting `top` or `bottom` property of slider element.
	 */
	protected continuousScrollDirection: 'up' | 'down' | null = null
	protected continuousSliderPosition: number | null = null
	protected scrollerBorderTopWidth: number = 0
	protected scrollerBorderBottomWidth: number = 0
	protected toCompleteRendering: Promise<void> | null = null

	/** Whole data from options. */
	protected rawData: T[] | null = null

	/** 
	 * PreRender renders 3x of templates, includes before, current, after.
	 * So it doesn't affect by scrolling direction.
	 */
	protected toCompletePreRendering: Promise<void> | null = null
	protected preRenderStartIndex: number = 0
	protected preRendered: Map<T, WatchedTemplate<T>> = new Map()

	constructor(anchor: NodeAnchor, context: Context) {
		super(anchor, context)
		this.initElements()
	}

	protected async initElements() {
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

		on(this.scroller, 'scroll.passive', this.onScroll, this)
		
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
		let firstlyUpdate = !this.options.updated
		this.options.update(options)
		this.templateFn = templateFn
		this.transition.updateOptions(transitionOptions)

		if (options.data !== undefined) {
			if (firstlyUpdate && options.data && options.startIndex > 0) {
				// `this.data` is not assigned yet, so cant use `limitStartIndex`
				let renderCount = this.options.get('pageSize') * this.options.get('renderPageCount')
				let startIndex = Math.min(options.startIndex, options.data.length - renderCount)
				this.startIndex = Math.max(0, startIndex)
				this.needToApplyStartIndex = true
			}
	
			this.watchRawDataAndUpdate(options.data)
		}
	}

	protected watchRawDataAndUpdate(data: Iterable<T> | null) {
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

		let endIndex = this.getLimitedEndIndex()
		let data = this.rawData ? this.rawData.slice(this.startIndex, endIndex) : []

		this.toCompleteRendering = this.updateData(data)
		await this.toCompleteRendering
		this.toCompleteRendering = null

		if (this.options.get('preRendering')) {
			this.checkPreRendering()
		}
	}

	protected async updateData(data: T[]) {
		super.updateData(data)

		let onUpdated = this.options.get('onUpdated')
		if (onUpdated) {
			onUpdated(this.data, this.startIndex)
		}

		await renderComplete()
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
	}

	/** `this.data` must be determinated. */
	protected limitStartIndex(index: number): number {
		let renderCount = this.options.get('pageSize') * this.options.get('renderPageCount')
		let endIndex = this.limitEndIndex(index + renderCount)
		let startIndex = Math.max(0, endIndex - renderCount)

		return startIndex
	}

	protected limitEndIndex(index: number): number {
		let maxCount = this.getTotalDataCount()
		if (maxCount >= 0 && index > maxCount) {
			index = maxCount
		}

		return index
	}

	/** `this.startIndex` must be determinated. */
	protected getLimitedEndIndex(): number {
		let renderCount = this.options.get('pageSize') * this.options.get('renderPageCount')
		let endIndex = this.limitEndIndex(this.startIndex + renderCount)

		return endIndex
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
		let countBeforeStart = this.startIndex
		let countAfterEnd = 0
		let endIndex = this.getLimitedEndIndex()
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

	protected measureAverageItemHeight() {
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

	protected getElementOfIndex(index: number) {
		let wtem = this.wtems[index - this.startIndex]
		if (wtem) {
			return wtem.template.range.getFirstElement()
		}

		return null
	}

	protected async onScroll() {
		this.checkRenderedRange()
	}

	protected checkRenderedRange() {
		let scrollerRect = this.scroller.getBoundingClientRect()
		let sliderRect = this.slider.getBoundingClientRect()

		if (scrollerRect.top < sliderRect.top) {
			this.updateToCover('up')
		}
		else if (scrollerRect.bottom > sliderRect.bottom) {
			this.updateToCover('down')
		}
	}

	// `direction` means where we render new items, and also the direction that the value of `startIndex` will change to.
	protected async updateToCover(scrollDirection: 'up' | 'down') {
		let renderCount = this.options.get('pageSize') * this.options.get('renderPageCount')
		let startIndex = -1

		if (scrollDirection === 'up') {
			let visibleIndex = this.locateLastVisibleIndex()
			if (visibleIndex > -1) {
				startIndex = visibleIndex + 1 - renderCount
			}
		}
		else {
			let visibleIndex = this.locateFirstVisibleIndex()
			if (visibleIndex > -1) {
				startIndex = visibleIndex
			}
		}

		// In this situation two rendering have no sharing part
		if (startIndex === -1) {
			if (scrollDirection === 'up') {
				startIndex = Math.ceil((this.scroller.scrollTop + this.scroller.clientHeight) / this.averageItemHeight) - renderCount
			}
			else {
				startIndex = Math.floor(this.scroller.scrollTop / this.averageItemHeight)
			}
		}

		startIndex = this.limitStartIndex(startIndex)
		let endIndex = this.limitEndIndex(startIndex + renderCount)

		this.validateContinuousScrolling(scrollDirection, startIndex, endIndex)

		this.startIndex = startIndex
		this.update()
	}

	protected locateFirstVisibleIndex(): number {
		return this.locateVisibleIndex(true)
	}

	protected locateLastVisibleIndex(): number {
		return this.locateVisibleIndex(false)
	}

	protected locateVisibleIndex(isFirst: boolean): number {
		let scrollerRect = this.scroller.getBoundingClientRect()

		let visibleIndex = binaryFindIndexToInsert(this.wtems as WatchedTemplate<T>[], (wtem) => {
			let firstElement = wtem.template.range.getFirstElement()
			if (firstElement) {
				let rect = firstElement.getBoundingClientRect()
				if (rect.bottom <= scrollerRect.top) {
					return 1
				}
				else if (rect.top >= scrollerRect.bottom) {
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
		if (firstElementRect.bottom <= scrollerRect.top) {
			visibleIndex += 1
		}
		else if (firstElementRect.top >= scrollerRect.bottom) {
			visibleIndex -= 1
		}

		if (visibleIndex >= 0 && visibleIndex < this.data.length) {
			return this.startIndex + visibleIndex
		}

		return -1
	}

	protected validateContinuousScrolling(scrollDirection: 'up' | 'down', startIndex: number, endIndex: number) {
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

	protected getSliderTopPosition() {
		let scrollerPaddingAreaTop = this.scroller.getBoundingClientRect().top - this.scrollerBorderTopWidth!
		let sliderAreaTop = this.slider.getBoundingClientRect().top

		return sliderAreaTop - scrollerPaddingAreaTop + this.scroller.scrollTop
	}

	protected getSliderBottomPosition() {
		let scrollerPaddingAreaBottom = this.scroller.getBoundingClientRect().bottom + this.scrollerBorderBottomWidth
		let sliderAreaBottom = this.slider.getBoundingClientRect().bottom
		
		return sliderAreaBottom - scrollerPaddingAreaBottom + this.scroller.scrollTop
	}


	// Handle pre rendering
	protected async checkPreRendering() {
		if (this.toCompletePreRendering) {
			return
		}

		this.toCompletePreRendering = this.doingUpdatePreRendering()
		await this.toCompletePreRendering
		this.toCompletePreRendering = null
	}

	protected async doingUpdatePreRendering() {
		// Wait page to layout & render
		await untilNextFrame()
		await this.updatePreRendering()
	}

	protected async updatePreRendering() {
		let totalCount = this.getTotalDataCount()
		let renderCount = this.options.get('pageSize') * this.options.get('renderPageCount')
		let startIndex = Math.max(0, this.startIndex - renderCount)
		let endIndex = Math.min(totalCount, this.startIndex + renderCount * 2)
		let startTime: number = performance.now()

		let data = await this.getDataBetweens(startIndex, endIndex)
		let dataSet: Set<T> = new Set(data)

		for (let item of this.preRendered.keys()) {
			if (!dataSet.has(item)) {
				let wtem = this.preRendered.get(item)!
				wtem.remove()
				this.preRendered.delete(item)
			}
		}

		for (let i = 0; i < data.length; i++) {
			let item = data[i]
			let index = i + startIndex

			if (!this.preRendered.has(item)) {
				let wtem = new WatchedTemplate(this.context, this.templateFn, item, index)
				wtem.template.preRender()
				this.preRendered.set(item, wtem)
			}

			if (i % 10 === 0) {
				let currentTime = performance.now()
				if (currentTime - startTime > 10) {
					startTime = currentTime
					await untilNextFrame()

					// Is rendering, no need to update,
					// Will start a new prerendering later.
					if (this.toCompleteRendering) {
						return
					}
				}
			}
		}

		this.preRenderStartIndex = startIndex
	}

	protected async getDataBetweens(startIndex: number, endIndex: number) {
		return this.rawData ? this.rawData.slice(startIndex, endIndex) : []
	}
	
	// Overwrites methods of super class
	protected shouldReuse(item: T) {
		return !this.options.get('preRendering') || !this.preRendered.has(item)
	}

	protected reuseOne(wtem: WatchedTemplate<T>, item: T, index: number) {
		if (this.options.get('preRendering')) {
			this.preRendered.delete(wtem.item)
			this.preRendered.set(item, wtem)
		}

		super.reuseOne(wtem, item, index)
	}

	protected createWatchedTemplate(item: T, index: number): WatchedTemplate<T> {
		if (this.options.get('preRendering')) {
			if (this.preRendered.has(item)) {
				return this.preRendered.get(item)!
			}
			else {
				let wtem = super.createWatchedTemplate(item, index)
				this.preRendered.set(wtem.item, wtem)
				return wtem
			}
		}
		else {
			return super.createWatchedTemplate(item, index)
		}
	}

	protected onWatchedTemplateNotInUse(wtem: WatchedTemplate<T>) {

		// Note than we doesn't cache the removed wtem,
		// The reason is the component will trigger disconnect,
		// And when reconnect, it will update, even if we keep watcher alive here.
		if (this.options.get('preRendering')) {
			this.preRendered.delete(wtem.item)
		}
		
		wtem.remove()
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
		this.startIndex = this.limitStartIndex(index)
		this.needToApplyStartIndex = true
		this.continuousScrollDirection = null

		// It doesn't update immediately because `rawData` may changed and will update soon.
		// Need to wait reset `needToApplyStartIndex` in `updateData`.
		await renderComplete()

		if (this.toCompleteRendering) {
			await this.toCompleteRendering
		}

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
		let scrollerRect = this.scroller.getBoundingClientRect()

		// Below it, need to scroll up
		if (rect.bottom > scrollerRect.bottom) {
			this.scroller.scrollTop = this.scroller.scrollTop + (scrollerRect.bottom - rect.bottom)
		}
		// Above it, need to scroll down
		else if (rect.top < scrollerRect.top) {
			this.scroller.scrollTop = this.scroller.scrollTop + (scrollerRect.top - rect.top)
		}
	}

	remove() {
		if (this.unwatchData) {
			this.unwatchData()
		}

		if (this.options.get('preRendering')) {
			for (let wtem of this.preRendered.values()) {
				wtem.remove()
			}
		}
		else {
			for (let wtem of this.wtems) {
				wtem.remove()
			}
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
export const liveRepeat = defineDirective(LiveRepeatDirective) as <Item>(
	options: LiveRepeatOptions<Item>,
	templateFn: TemplateFn<Item>,
	transitionOptions?: DirectiveTransitionOptions
) => DirectiveResult


function untilNextFrame() {
	return new Promise(resolve => {
		requestAnimationFrame(resolve)
	})
}