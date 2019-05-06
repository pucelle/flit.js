import {defineDirective, DirectiveResult} from './define'
import {Context} from '../component'
import {DirectiveTransitionOptions, WatchedTemplate} from './shared'
import {NodeAnchor, NodeAnchorType} from '../node-helper'
import {on} from '../dom-event'
import {Watcher} from '../watcher'
import {TemplateResult} from '../parts'
import {RepeatDirective} from './repeat'
import {onRenderComplete} from '../queue'
import {binaryFindIndexToInsert, ScrollerClientRect} from './helper'


interface LiveOptions<T> {
	groupSize: number
	renderGroupCount?: number
	data?: Iterable<T>
	dataCount?: number | Promise<number>
	dataGetter?: GroupDataGetter<T>
	startIndex?: number
	averageItemHeight?: number
}

type GroupDataGetter<T> = (start: number, size: number) => Promise<Iterable<T>> | Iterable<T>

// Compare to `TempalteFn`, the `item` can accpet `null` as argument when data is still loading.
type LiveTemplateFn<T> = (item: T | null, index: number) => TemplateResult


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

export class LiveRepeatDirective<T> extends RepeatDirective<T | null> {

	private dataWatcher: Watcher<T[]> | null = null

	/** The parent node of `anchorNode`, it's `overflow` value must be `auto` or `scroll`. */
	private scroller!: HTMLElement
	private startPlaceholder!: HTMLElement
	private endPlaceholder!: HTMLElement

	/**
	* How many items to render each time.
	* If you are using dynamic data, you should set this value to count of data that you ajax interface returned.
	* Otherwise you should set this value big enough to cover viewport, but too big to render too much items.
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

	/** Specify whole data or an promise function to get grouped data */
	private data: T[] | null = null

	/**
	 * Specify whole data count when using async data.
	 * `-1` means the total count is not determinated yet.
	 * We will try to get the data count value when assigning render options.
	 */
	private dataCount: number = -1

	private dataGetter: GroupDataGetter<T> | null = null

	/** `startIndex` can only be set for once from `options`. */
	private startIndexApplied: boolean = false

	/** 
	 * Caluated average item height by this value, it will be used to calculate start and end placeholder height.
	 * It will be detected automatically from the first rendering if was not initialized.
	 */
	private averageItemHeight: number = 0

	/** We need this property to keep the element's position by adjusting `scroller.scrollTop`. */
	private lastVisibleElement: HTMLElement | null = null

	/** When requesting data, scroll event should not trigger rerendering, this value will be set to `true`. */
	//private lockRendering: boolean = false

	constructor(
		anchor: NodeAnchor,
		context: Context,
		options: LiveOptions<T>,
		templateFn: LiveTemplateFn<T>,
		transitionOptions?: DirectiveTransitionOptions
	) {
		super(anchor, context, null, templateFn, transitionOptions)

		this.initElementsAndAnchor(anchor)
		this.setRenderOptions(options)
		this.updateLiveProperties()
	}

	initItems() {}

	private initElementsAndAnchor(anchor: NodeAnchor) {
		this.scroller = anchor.el.parentElement as HTMLElement
		on(this.scroller, 'scroll.passive', this.onScroll, this)

		this.endPlaceholder = document.createElement('div')
		this.endPlaceholder.style.cssText = 'margin: 0; padding: 0; height: 0;'
		;(anchor.el as ChildNode).after(this.endPlaceholder)

		this.startPlaceholder = document.createElement('div')
		this.startPlaceholder.style.cssText = 'margin: 0; padding: 0; height: 0;'
		;(anchor.el as ChildNode).after(this.startPlaceholder)

		this.anchor = new NodeAnchor(this.endPlaceholder, NodeAnchorType.Next)
	}

	private setRenderOptions(options: LiveOptions<T>) {
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

			// Use old value
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
		catch {
			throw new Error(`The "templateFn" must can render "null" to a template result in async mode`)
		}
	}

	private watchData(data: Iterable<T>) {
		if (this.dataWatcher) {
			this.dataWatcher.disconnect()
		}

		let watchFn = () => {
			return [...data]
		}

		let onUpdate = (data: T[]) => {
			this.data = data
			this.updateLiveProperties()
		}

		this.dataWatcher = new Watcher(watchFn, onUpdate)
		this.data = this.dataWatcher.value
	}

	canMergeWith(_options: any, templateFn: LiveTemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(options: any, _templateFn: LiveTemplateFn<T>, transitionOptions?: DirectiveTransitionOptions) {
		this.setRenderOptions(options as LiveOptions<T>)
		this.transition.setOptions(transitionOptions)
		this.updateLiveProperties()
	}

	/** Update live properties. The `startIndex` is prepared now. */
	private async updateLiveProperties() {
		// Note that the `endIndex` may be larger than data length.
		// Items betweens `startIndex` and `endIndex `should cover the viewport.
		let startIndex = this.startIndex
		let endIndex = this.limitIndex(startIndex + this.groupSize * this.renderGroupCount)
		
		let offsetTopOfLastVisibleElement: number | undefined
		if (this.lastVisibleElement) {
			offsetTopOfLastVisibleElement = this.lastVisibleElement.offsetTop
		}

		if (this.data) {
			this.updateLiveItems(this.data.slice(startIndex, endIndex))
		}
		else {
			this.updateLiveItems(await this.requestGroupedDataBetweens(startIndex, endIndex))
		}

		this.updatePlaceholderHeights()

		
		let startPlaceholder = this.startPlaceholder
		startPlaceholder.before(this.startPlaceholder = startPlaceholder.cloneNode() as HTMLElement)
		startPlaceholder.remove()

		// `onRenderComplete` is absolutely required,
		// we can makesure that the component are rendered only after inserted into document,
		// but directive may be still in fragment when was initialized using `render`.
		onRenderComplete(() => {
			if (!this.averageItemHeight) {
				this.measureSizes()
			}

			if (this.startIndexApplied) {
				this.adjustScrollPosition(offsetTopOfLastVisibleElement)
			}
			else {
				this.scroller.scrollTop = this.startPlaceholder.offsetHeight
				this.startIndexApplied = true
			}
		})
	}

	private updateLiveItems(items: T[] | null[]) {
		// There is a big issue here:
		// When no child nodes moved in scroller,
		// updating height of placeholders will cause `scrollTop` of scroller changed.
		this.updateItems(items)
	}

	private limitIndex(index: number): number {
		if (this.data && index > this.data.length) {
			index = this.data.length
		}

		if (this.dataCount >= 0 && index > this.dataCount) {
			index = this.dataCount
		}

		return index
	}

	private requestGroupedDataBetweens(startIndex: number, endIndex: number): null[] {
		let dataGetter = this.dataGetter!
		let startGroupIndex = Math.floor(startIndex / this.groupSize)	//49 -> 0, 50 -> 1
		let endGroupIndex = Math.floor((endIndex - 1) / this.groupSize) + 1	// 50 -> 1, 51 -> 2
		let promises: Promise<Iterable<T>>[] = []

		for (let i = startGroupIndex; i < endGroupIndex; i++) {
			let mayAsyncData = dataGetter(i * this.groupSize, this.groupSize)
			if (mayAsyncData instanceof Promise) {
				promises.push(mayAsyncData)
			}
			else {
				promises.push(Promise.resolve(mayAsyncData))
			}
		}
		
		// If can't got all grouped data immediately (at least before micro task queue),
		// and can render `null` values as placeholders,
		// We will replace them after data prepared.
		// Don't worry about promises were resolved immediately,
		// `liveItems` will be replaced before rendering.
		let placeholderData: null[] = []
		for (let i = startIndex; i < endIndex; i++) {
			placeholderData.push(null)
		}

		// let dataPromise = new Promise(async (resolve) => {
		// 	//this.lockRendering = true
		
		// 	let dataArray = await Promise.all(promises)
		// 	let data: T[] = []
	
		// 	for (let item of dataArray) {
		// 		data.push(...item)
		// 	}
	
		// 	data = data.slice(
		// 		startIndex - startGroupIndex * this.groupSize,
		// 		endIndex - startGroupIndex * this.groupSize
		// 	)
	
		// 	//this.lockRendering = false
		// 	resolve(data)
		// }) as Promise<T[]>
		
		// dataPromise.then(data => {
		// 	if (this.items === placeholderData) {
		// 		this.updateLiveItems(data)
		// 	}
		// })

		return placeholderData
	}

	// `items` are prepared now.
	private updatePlaceholderHeights() {
		if (!this.averageItemHeight) {
			return
		}

		let countBeforeStart = this.startIndex
		let endIndex = this.startIndex + this.items.length
		let countAfterEnd = 0

		if (this.data) {
			countAfterEnd = Math.max(0, this.data.length - endIndex)
		}
		else if (this.dataCount) {
			countAfterEnd = Math.max(0, this.dataCount - endIndex)
		}

		this.startPlaceholder.style.height = this.averageItemHeight * countBeforeStart + 'px'
		this.endPlaceholder.style.height = this.averageItemHeight * countAfterEnd + 'px'
	}

	private measureSizes() {
		if (this.items.length === 0) {
			return
		}

		// Here it is not 100% right when `groupSize` is not big enough.
		// Assume that there is only one `30px` height item with `10px` margin,
		// You will got wrong value 50, not right value 40.
		let startPlaceholderBottom = this.startPlaceholder.offsetTop - this.startPlaceholder.offsetHeight
		let endPlaceHolderTop = this.endPlaceholder.offsetTop
		let totalHeight = endPlaceHolderTop - startPlaceholderBottom
		if (totalHeight <= 0) {
			return
		}

		let scrollerHeight = this.scroller.clientHeight
		let needsRerender = false

		this.averageItemHeight = Math.round(totalHeight / this.items.length)

		while (totalHeight < scrollerHeight) {
			this.renderGroupCount *= 2
			totalHeight *= 2
			needsRerender = true
		}

		this.updatePlaceholderHeights()

		if (needsRerender) {
			this.checkRenderingRange()
		}
	}

	private adjustScrollPosition(oldOffsetTop: number | undefined) {
		if (this.lastVisibleElement) {
			let newOffsetTop = 0
			let scrollTopDiff = oldOffsetTop! - newOffsetTop

			// If all items have same height, `scrollTopDiff` will always be `0`.
			// Never update `scroller.scrollTop`, it will cause unexpected scrolling,
			// because scroll events works on a `passive` mode.
			if (scrollTopDiff !== 0) {
				//this.startPlaceholder.style.height = this.startPlaceholder.offsetHeight + scrollTopDiff + 'px'
			}
		}

		// The rendering result may be 'short' and can't cover viewport, so we need to recheck it.
		// It will trigger a new `scroll` event since we just updated placeholder heights.
		// E.g., we scrolled up to trigger `update('up')` and newly rendered items can't cover scroller bottom,
		// The only short is that when scrolled up for a little later, it will trigger another `update('up')`.
	}

	private onScroll() {
		this.checkRenderingRange()
	}

	private checkRenderingRange() {
		let scrollerRect = new ScrollerClientRect(this.scroller)
		
		if (!scrollerRect.isRectAbove(this.startPlaceholder.getBoundingClientRect())) {
			this.update('up')
		}
		else if (!scrollerRect.isRectBelow(this.endPlaceholder.getBoundingClientRect())) {
			this.update('down')
		}
	}

	// Direction means where we render new items, and also the direction the value of `startIndex` will change to.
	private update(direction: 'up' | 'down') {
		let endIndex = -1
		this.lastVisibleElement = null

		if (direction === 'up') {
			endIndex = this.findLastVisibleIndex()
		}
		else {
			let startIndex = this.findFirstVisibleIndex()
			if (startIndex > -1) {
				endIndex = startIndex + this.groupSize * this.renderGroupCount
			}
		}
		
		if (endIndex === -1) {
			if (direction === 'up') {
				endIndex = Math.ceil((this.scroller.scrollTop + this.scroller.clientHeight) / this.averageItemHeight)
			}
			else {
				endIndex = Math.floor(this.scroller.scrollTop / this.averageItemHeight)
						 + this.groupSize * this.renderGroupCount
			}
		}

		endIndex = this.limitIndex(endIndex)

		this.startIndex = Math.max(0, endIndex - this.groupSize * this.renderGroupCount)
		this.updateLiveProperties()
	}

	// Partial visible is OK too.
	private findFirstVisibleIndex(): number {
		let scrollerRect = new ScrollerClientRect(this.scroller)

		let index = binaryFindIndexToInsert(this.wtems as WatchedTemplate<T>[], (wtem) => {
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
			this.lastVisibleElement = firstElement
			return this.startIndex + index
		}
		
		return -1
	}

	// Partial visible is OK too.
	private findLastVisibleIndex(): number {
		let scrollerRect = new ScrollerClientRect(this.scroller)

		let index = binaryFindIndexToInsert(this.wtems as WatchedTemplate<T>[], (wtem) => {
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
			this.lastVisibleElement = firstElement
			return this.startIndex + index
		}

		return -1
	}

	remove() {
		this.startPlaceholder.remove()
		this.endPlaceholder.remove()

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
export const liveRepeat = defineDirective(LiveRepeatDirective) as <T>(
	options: LiveOptions<T>,
	templateFn: LiveTemplateFn<T>,
	transitionOptions?: DirectiveTransitionOptions
) => DirectiveResult

