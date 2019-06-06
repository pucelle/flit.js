import {defineDirective, DirectiveResult} from './define'
import {Context} from '../component'
import {DirectiveTransitionOptions, WatchedTemplate, TemplateFn} from './shared'
import {NodeAnchor} from '../node-helper'
import {on} from '../dom-event'
import {Watcher} from '../watcher'
import {RepeatDirective} from './repeat'
import {onRenderComplete, renderComplete} from '../queue'
import {binaryFindIndexToInsert, ScrollerClientRect, throttleByAnimationFrame} from './helper'


interface LiveOptions<Item> {
	pageSize?: number			// Not updatable
	renderPageCount?: number	// Not updatable
	averageItemHeight?: number	// Not updatable
	ref?: (dir: LiveRepeatDirective<Item>) => void	// Not updatable
	data: Iterable<Item> | null
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

	/** `startIndex` can only be set for once from `options`. */
	protected needToApplyStartIndex: boolean = false

	/** 
	 * Average item height value, it is used to calculate the position of the `slider`.
	 * It will be detected automatically from the first rendering if was not initialized.
	 */
	protected averageItemHeight: number = 0

	/** Whole data from options. */
	private rawData: Item[] | null = null

	/** 
	 * When we scrolled up or down, we don't know about the height of just inserted or removed elements.
	 * So we need this property to specify the element in the index, and keep it's scrolling position by adjusting.
	 */
	private indexToKeepPosition: number = -1
	private lastTopOfKeepPositionElement: number = -1

	constructor(anchor: NodeAnchor, context: Context) {
		super(anchor, context)
		this.initElements()
	}

	private initElements() {
		this.slider = this.anchor.el.parentElement as HTMLElement
		this.scroller = this.slider.parentElement as HTMLElement
		
		if (!this.slider || !this.scroller || this.scroller.children.length !== 1) {
			throw new Error(`"liveRepeat" must be contained in the struct like "
				<div style="overflow: auto | scroll">
					<div>
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
		this.updateRenderOptions(options as LiveOptions<Item>)
		this.transition.setOptions(transitionOptions)
		this.update()
		this.firstlyMerge = false
	}

	protected validateTemplateFn(_templateFn: TemplateFn<Item>) {}

	protected initRenderOptions(options: LiveOptions<Item>) {
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
	protected updateRenderOptions(options: LiveOptions<Item>) {
		if (options.averageItemHeight) {
			this.averageItemHeight = options.averageItemHeight
		}

		if (options.data !== undefined) {
			this.watchAndAssignRawData(options.data)
		}
	}

	private watchAndAssignRawData(data: Iterable<Item> | null) {
		if (data === this.lastData) {
			return
		}

		this.lastData = data

		if (this.dataWatcher) {
			this.dataWatcher.disconnect()
		}

		if (!data) {
			this.rawData = []
			return
		}

		let watchFn = () => {
			return [...data]
		}

		let onUpdate = (data: Item[]) => {
			this.rawData = data
			this.update()
		}

		this.dataWatcher = new Watcher(watchFn, onUpdate)
		this.rawData = this.dataWatcher.value
	}

	protected async update() {
		let endIndex = this.limitEndIndex(this.startIndex + this.pageSize * this.renderPageCount)
		let data = this.rawData ? this.rawData.slice(this.startIndex, endIndex) : []
		await this.updateData(data)
	}

	protected async updateData(data: Item[]) {
		super.updateData(data)

		if (this.averageItemHeight) {
			this.updateSliderPosition()
		}

		if (data.length > 0) {
			// `renderComplete` is absolutely required,
			// we can makesure that the component are rendered only after inserted into document,
			// but directive may be still in fragment when was initialized using `render`.
			await renderComplete()

			if (!this.renderPageCountChecked && this.mayDoubleRenderPageCount()) {
				this.renderPageCountChecked = true
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

		this.slider.style.marginTop = this.averageItemHeight * countBeforeStart + 'px'
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

		let sliderHeight = this.slider.offsetHeight
		let scrollerHeight = this.scroller.clientHeight
		let changed = false

		while (sliderHeight < scrollerHeight) {
			this.renderPageCount *= 2
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

	// Direction means where we render new items, and also the direction that the value of `startIndex` will change to.
	private updateToCover(direction: 'up' | 'down') {
		let endIndex = -1
		let visibleIndex = -1

		if (direction === 'up') {
			endIndex = visibleIndex = this.locateLastVisibleIndex()
		}
		else {
			let startIndex = visibleIndex = this.locateFirstVisibleIndex()
			if (startIndex > -1) {
				endIndex = startIndex + this.pageSize * this.renderPageCount
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
						 + this.pageSize * this.renderPageCount
			}
		}

		endIndex = this.limitEndIndex(endIndex)

		this.startIndex = Math.max(0, endIndex - this.pageSize * this.renderPageCount)
		this.update()
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

		if (index === this.data.length) {
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

		if (index === this.data.length) {
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
	options: LiveOptions<Item>,
	templateFn: TemplateFn<Item>,
	transitionOptions?: DirectiveTransitionOptions
) => DirectiveResult

