import {locateLastVisibleIndex, locateFirstVisibleIndex, getRect, Rect} from '../../helpers/utils'
import {onRenderComplete, untilRenderComplete} from '../../queue'
import {OffsetChildren} from './offset-children'


// What to process:
//
// When initializing or update from applied start index:
//   Update indices.
//   Update placeholder height and scroll top.
//   Will cause scroll event trigger and validate rendering result coverage and re-render if required.
// 
// When scrolling up or down down:
//   Update scroll direction.
//   Validate rendering result coverage.
//   Decrease `startIndex` or increase `endIndex` to render more contents if not fully covered.
//   Re-rendering if have no interesction with scroller and slider.
//   Shrink items if have rendered too much.
//


/** Function for doing updating, resolved after render complete and can check computed styles. */
type UpdatingFunction = (startIndex: number, endIndex: number, scrollDirection: 'up' | 'down' | null) => void


export class PartialRenderingProcessor {

	/** The parent node of `anchorNode`, it will be used as a slider to slide in the scroller element. */
	private readonly slider!: HTMLElement

	/** The parent node of `slider`, it's `overflow` value must be `auto` or `scroll`. */
	private readonly scroller!: HTMLElement

	/** Placeholder element to keep whole scroll height. */
	private readonly palceholder: HTMLDivElement

	/** To visit repetitive children. */
	private readonly sliderChildren: OffsetChildren

	/** Size of each time render count. */
	private renderCount: number = 50

	/** Render count of groups, increase if not enough. */
	private renderGroupCount: number = 1

	/** Border tio and bottom width. */
	private scrollerBorderTopWidth: number = 0
	private scrollerBorderBottomWidth: number = 0

	/** The start index of first item in the whole data. */
	private startIndex: number = 0

	/** The end index of next position of last item in the whole data. */
	private endIndex: number = 0


	/** The start index of first item and should be applied when next time rendering. */
	private startIndexToApply: number | null = 0

	/** Current total data count. */
	private totalDataCount: number = 0

	/** `totalDataCount` changed and needs to be applied. */
	private needToUpdatePlaceholderHeights: boolean = false

	/** 
	 * Average item height in pixels, it is used to calculate the position of the `slider`.
	 * It will be detected automatically from the first rendering if was not initialized.
	 */
	private averageItemHeight: number = 0

	/** The item count, will not update placeholder height when scrolling up. */
	private itemCountWhenUpdatePlaceholderHeight: number = 0

	/** If is not `null`, means updating is not completed yet. */
	private untilUpdatingCompletePromise: Promise<void> | null = null

	constructor(scroller: HTMLElement, slider: HTMLElement, sliderChildren: OffsetChildren) {
		this.scroller = scroller
		this.slider = slider
		this.sliderChildren = sliderChildren

		this.palceholder = document.createElement('div')
		this.palceholder.style.cssText = 'position: absolute; left: 0; top: 0; width: 1px; visibility: hidden;'
		this.scroller.prepend(this.palceholder)
		
		onRenderComplete(() => {
			this.onFirstTimeRenderCompleted()
		})
	}

	/** Update `renderCount` property. */
	updateRenderCount(renderCount: number) {
		this.renderCount = renderCount
	}

	/** Get how many groups need to render. */
	getRenderGroupCount() {
		return this.renderGroupCount
	}

	/** Begin to validate css properties after elements rendered. */
	private onFirstTimeRenderCompleted() {
		let computedStyle = getComputedStyle(this.scroller)
		if (!['scroll', 'auto'].includes(computedStyle.overflowY!)) {
			throw 'The  style value "overflow-y" of scroller element out of "liveRepeat" directive must be "scroll" or "auto"!'
		}

		if (computedStyle.position === 'static') {
			throw 'The style value "position" of scroller element out of "liveRepeat" directive must not be "static"!'
		}

		if (getComputedStyle(this.slider).position !== 'absolute') {
			throw 'The style value "position" of slider element out of "liveRepeat" directive must not be "absolute"!'
		}

		this.scrollerBorderTopWidth = Number(getComputedStyle(this.scroller).borderTopWidth!.replace('px', '')) || 0
		this.scrollerBorderBottomWidth = Number(getComputedStyle(this.scroller).borderBottomWidth!.replace('px', '')) || 0
	}

	/** Will locate to index when next time rendering. */
	setStartIndex(index: number) {
		this.startIndexToApply = index
	}

	/** Whether specifies a start index. */
	isStartIndexSpecified() {
		return this.startIndexToApply !== null
	}

	/** Update total data count after reload data. */
	updateDataCount(dataCount: number) {
		this.totalDataCount = dataCount
		this.needToUpdatePlaceholderHeights = true
	}

	/** 
	 * Update from applied start index or current scroll position.
	 * Note it must calls `doDataUpdating` synchronously since it's already in a updating queue.
	 */
	updateSynchronously(doDataUpdating: UpdatingFunction) {
		// Scroll to specified index.
		if (this.startIndexToApply !== null) {
			this.updateWhenStartIndexWillApply(doDataUpdating)
		}

		// Data should changed, reset from current scroll position.
		else if (this.needToUpdatePlaceholderHeights) {
			this.updateFromCurrentScrollOffset(doDataUpdating)
		}

		// Just keep indices and update data.
		else {
			doDataUpdating(this.startIndex, this.endIndex, null)
		}

		this.updatePlaceholderHeightIfNeeded()

		this.untilUpdatingCompletePromise = untilRenderComplete().then(() => {
			this.untilUpdatingCompletePromise = null
		})
	}

	/** 
	 * Update only when slider can't cover scroller, and also keep continuous scroll position.
	 * Returns whether updated.
	 */
	async updateSmoothly(doDataUpdating: UpdatingFunction) {
		// Last updating is not completed.
		if (this.untilUpdatingCompletePromise) {
			return
		}

		// Reach start or end edge.
		if (this.startIndex === 0 && this.endIndex === this.totalDataCount) {
			return
		}

		let updatingPromise = this.updateFromCoverage(doDataUpdating)
		
		this.untilUpdatingCompletePromise = updatingPromise.then(() => {
			this.untilUpdatingCompletePromise = null
		})

		let updated = await updatingPromise
		if (updated) {
			this.updatePlaceholderHeightIfNeeded()
		}
	}

	/** Update when start index specified. */
	private updateWhenStartIndexWillApply(doDataUpdating: UpdatingFunction) {
		this.updateIndices(this.startIndexToApply!)
		this.startIndexToApply = null
		this.resetSliderPosition()

		doDataUpdating(this.startIndex, this.endIndex, null)

		// Check rendering heights.
		if (!this.averageItemHeight && this.totalDataCount > 0) {
			onRenderComplete(() => {
				this.measureRenderingSizes()
				this.updatePlaceholderHeightIfNeeded()

				// Re-calcuate position and scroll offset.
				if (this.startIndex > 0) {
					this.resetSliderPosition()
					this.updateScrollOffset()
				}
			})
		}
		else {
			this.updateScrollOffset()
		}

		// `updateScrollOffset` will trigger scroll event, so no need to validate coverage.
	}

	/** Update start and end index before rendering. */
	private updateIndices(startIndex: number) {
		let renderCount = this.renderCount * this.renderGroupCount

		startIndex = Math.min(startIndex, this.totalDataCount - renderCount)
		startIndex = Math.max(0, startIndex)

		let endIndex = startIndex + renderCount
		endIndex = Math.min(endIndex, this.totalDataCount)

		this.startIndex = startIndex
		this.endIndex = endIndex
	}

	/** Measure to get a not 100% precise average item height. */
	private measureRenderingSizes() {
		let scrollerHeight = this.scroller.clientHeight
		let sliderHeight = this.slider.offsetHeight
		if (!sliderHeight) {
			return
		}

		this.averageItemHeight = Math.round(sliderHeight / (this.endIndex - this.startIndex))

		if (this.averageItemHeight) {
			this.renderGroupCount = Math.ceil(scrollerHeight / this.averageItemHeight / this.renderCount)
		}
	}

	/** Update height of placeholder only if needed. */
	private updatePlaceholderHeightIfNeeded() {
		if (this.needToUpdatePlaceholderHeights && this.averageItemHeight) {
			this.palceholder.style.height = this.averageItemHeight * this.totalDataCount + 'px'
			this.needToUpdatePlaceholderHeights = false
		}
	}

	/** Update height of placeholder progressive, form current item count and their height. */
	private updatePlaceholderHeightProgressive(height: number, itemCount: number) {
		if (itemCount >= this.itemCountWhenUpdatePlaceholderHeight || itemCount === this.totalDataCount || this.needToUpdatePlaceholderHeights) {
			this.averageItemHeight = height / itemCount
			this.palceholder.style.height = this.averageItemHeight * this.totalDataCount + 'px'
			this.needToUpdatePlaceholderHeights = false
			this.itemCountWhenUpdatePlaceholderHeight = itemCount
		}
	}

	/** Update position of `slider` after set new indices. */
	private updateSliderPosition(direction: 'top' | 'bottom', position: number) {
		if (direction === 'top') {
			this.slider.style.top = position + 'px'
			this.slider.style.bottom = 'auto'
		}
		else {
			this.slider.style.bottom = position + 'px'
			this.slider.style.top = 'auto'
		}
	}

	/** Update position of `slider` after set new index. */
	private resetSliderPosition() {
		// May `averageItemHeight` be `0`, will update later in this scenario.
		let countBeforeStart = this.startIndex
		let newTop = this.averageItemHeight * countBeforeStart
		
		this.updateSliderPosition('top', newTop)
	}

	/** Update scroll offset of `scroller` after set new `startIndex`. */
	private updateScrollOffset() {
		let countBeforeStart = this.startIndex
		this.scroller.scrollTop = this.averageItemHeight * countBeforeStart
	}

	/** 
	 * Validate if slider fully covers scroller and update indices if not.
	 * Returns whether updated indices.
	 */
	 private async updateFromCoverage(doDataUpdating: UpdatingFunction): Promise<boolean> {
		let scrollerRect = this.getScrollerClientRect()
		let sliderRect = this.slider.getBoundingClientRect()
		let renderCount = this.renderCount * this.renderGroupCount
		let unexpectedScrollEnd = this.scroller.scrollTop + this.scroller.clientHeight === this.scroller.scrollHeight && this.endIndex < this.totalDataCount
		let unexpectedScrollStart = this.scroller.scrollTop === 0 && this.startIndex > 0

		// No intersection, reset slider position from current slider scroll offset.
		let hasNoIntersection = sliderRect.bottom < scrollerRect.top || sliderRect.top > scrollerRect.bottom
		if (hasNoIntersection) {
			this.updateFromCurrentScrollOffset(doDataUpdating)
			await untilRenderComplete()
		}

		// Scroll down and can't cover at bottom direction.
		// Otherwise will still load more when touch bottom scrolling edge and still more data exist.
		else if (sliderRect.bottom < scrollerRect.bottom || unexpectedScrollEnd) {
			let roughFirstVisibleIndex = locateFirstVisibleIndex(this.scroller, this.sliderChildren.getChildren(), 0)
			let oldStartIndex = this.startIndex
			let newStartIndex = this.startIndex + roughFirstVisibleIndex
	
			this.updateIndices(newStartIndex)
			await this.updateWithSliderPositionStable('down', oldStartIndex, scrollerRect, doDataUpdating)
		}

		// Scroll up and can't cover at top direction.
		// Keeps last visible index as endIndex.
		// Otherwise will still load more when touch top scrolling edge and still more data exist.
		else if (sliderRect.top > scrollerRect.top || unexpectedScrollStart) {
			let roughLastVisibleIndex = locateLastVisibleIndex(this.scroller, this.sliderChildren.getChildren(), 0)
			let oldStartIndex = this.startIndex
			let newEndIndex = this.startIndex + roughLastVisibleIndex + 1
			let newStartIndex = newEndIndex - renderCount

			this.updateIndices(newStartIndex)
			await this.updateWithSliderPositionStable('up', oldStartIndex, scrollerRect, doDataUpdating)
		}

		// No need to update.
		else {
			return false
		}

		return true
	}

	/** Get a fixed client rect of scroller. */
	protected getScrollerClientRect(): Rect {
		let scrollerRect = getRect(this.scroller)

		scrollerRect.top += this.scrollerBorderTopWidth
		scrollerRect.bottom -= this.scrollerBorderBottomWidth
		scrollerRect.height -= this.scrollerBorderTopWidth + this.scrollerBorderBottomWidth

		return scrollerRect
	}

	/** Re-generate indices from current scroll offset. */
	private updateFromCurrentScrollOffset(doDataUpdating: UpdatingFunction) {
		this.resetIndices()
		this.resetSliderPosition()

		doDataUpdating(this.startIndex, this.endIndex, null)
	}

	/** Reset indices from current scroll offset. */
	private resetIndices() {
		let newStartIndex = this.averageItemHeight > 0 ? Math.floor(this.scroller.scrollTop / this.averageItemHeight) : 0
		this.updateIndices(newStartIndex)
	}

	/** Update slider position to keep it in a stable position after updating data items. */
	protected async updateWithSliderPositionStable(scrollDirection: 'up' | 'down', oldStartIndex: number, scrollerRect: Rect, doDataUpdating: UpdatingFunction) {
		let visibleIndex = scrollDirection === 'down' ? this.startIndex - oldStartIndex : this.endIndex - 1 - oldStartIndex
		let visibleElement = this.sliderChildren.childAt(visibleIndex)
		let updateData = () => {doDataUpdating(this.startIndex, this.endIndex, scrollDirection)}

		if (!visibleElement) {
			throw new Error(`Wrongly rendered: can\'t found expected element in specified index!`)
		}

		// When reach start index but may not reach scroll start.
		if (this.startIndex === 0) {
			await this.updateWhenReachStartIndex(visibleElement, updateData)
		}

		// When reach end index but may not reach scroll end.
		else if (this.endIndex === this.totalDataCount) {
			await this.updateWhenReachEndIndex(visibleElement, updateData)
		}

		// When reach start index but not scroll index.
		else if (this.startIndex > 0 && this.scroller.scrollTop === 0) {
			await this.updateWhenReachScrollStart(visibleElement, scrollerRect, updateData)
		}

		// When reach scroll end but not end index.
		else if (this.endIndex < this.totalDataCount && this.scroller.scrollTop + this.scroller.clientHeight === this.scroller.scrollHeight) {
			await this.updateWhenReachScrollEnd(visibleElement, scrollerRect, updateData)
		}

		// Keeps visible element in the same scroll position.
		else if (scrollDirection === 'down') {
			await this.updateNormallyWhenScrollingDown(visibleElement, scrollerRect, updateData)
		}

		// Keeps visible element in the same scroll position.
		else {
			await this.updateNormallyWhenScrollingUp(visibleElement, scrollerRect, updateData)
		}
	}

	/** When reach start index but may not reach scroll start, reset scroll top. */
	protected async updateWhenReachStartIndex(lastVisibleElement: Element, updateData: () => void) {
		let visibleIndex = this.endIndex - 1 - this.startIndex
		let oldTop = lastVisibleElement.getBoundingClientRect().top

		this.updateSliderPosition('top', 0)

		// Render to locate first item.
		updateData()
		
		await untilRenderComplete()

		// Should keep the visible element stable.
		let newVisibleElement = this.sliderChildren.childAt(visibleIndex)
		let newTop = newVisibleElement.getBoundingClientRect().top
		let translate = newTop - oldTop

		// Set scroll top to restore it's translate, `scrollTop` property is opposite with translation, so here it's `+`.
		this.scroller.scrollTop = this.scroller.scrollTop + translate
	}

	/** When reach end index but may not reach scroll end, reset scroll top. */
	protected async updateWhenReachEndIndex(firstVisibleElement: Element, updateData: () => void) {
		let visibleIndex = 0
		let oldBottom = firstVisibleElement.getBoundingClientRect().bottom

		// Render to locate last item.
		updateData()

		await untilRenderComplete()

		// Get element translated.
		let newVisibleElement = this.sliderChildren.childAt(visibleIndex)
		let newBottom = newVisibleElement.getBoundingClientRect().bottom
		let translate = newBottom - oldBottom

		// Get new position.
		let scrollerRect = this.getScrollerClientRect()
		let sliderRect = this.slider.getBoundingClientRect()

		// should minus translate normally, but bottom property is opposite with translation, so here it's `+`.
		let position = scrollerRect.bottom - sliderRect.bottom + translate
		position -= this.scroller.scrollTop
		this.updateSliderPosition('bottom', position)

		// Scroll height is scroll top + bottom slider height relative to scroller top.
		let scrollHeight = this.scroller.scrollTop + sliderRect.bottom - scrollerRect.top - translate
		this.updatePlaceholderHeightProgressive(scrollHeight, this.endIndex)
	}

	/** When reach scroll start but not reach start index, provide more scroll space. */
	protected async updateWhenReachScrollStart(lastVisibleElement: Element, scrollerRect: Rect, updateData: () => void) {
		// Provide more spaces at start.
		let extendedScrollSpace = this.averageItemHeight * this.startIndex

		// Translate position from the spaces.
		let position = scrollerRect.bottom - lastVisibleElement.getBoundingClientRect().bottom
		position -= extendedScrollSpace
		this.updateSliderPosition('bottom', position)
		updateData()

		this.scroller.scrollTop = extendedScrollSpace
		await untilRenderComplete()
	}

	/** When reach scroll end but not reach end index, provide more scroll space. */
	protected async updateWhenReachScrollEnd(firstVisibleElement: Element, scrollerRect: Rect, updateData: () => void) {
		// Update normally.
		let position = firstVisibleElement.getBoundingClientRect().top - scrollerRect.top
		position += this.scroller.scrollTop
		this.updateSliderPosition('top', position)
		updateData()

		await untilRenderComplete()

		// Extend more spaces at end.
		let newScrollerRect = this.getScrollerClientRect()
		let sliderRect = this.slider.getBoundingClientRect()
		let scrollHeight = this.scroller.scrollTop + sliderRect.bottom - newScrollerRect.top

		this.updatePlaceholderHeightProgressive(scrollHeight, this.endIndex)
	}

	/** Render more items when scrolling down, not reset scroll position. */
	protected async updateNormallyWhenScrollingDown(firstVisibleElement: Element, scrollerRect: Rect, updateData: () => void) {
		let position = firstVisibleElement.getBoundingClientRect().top - scrollerRect.top
		position += this.scroller.scrollTop
		this.updateSliderPosition('top', position)

		// This update will cause scroll bar position bounces at top bottom.
		this.updatePlaceholderHeightProgressive(position, this.startIndex)

		updateData()
		await untilRenderComplete()
	}

	/** Render more items when scrolling up, not reset scroll position. */
	protected async updateNormallyWhenScrollingUp(lastVisibleElement: Element, scrollerRect: Rect, updateData: () => void) {
		let position = scrollerRect.bottom - lastVisibleElement.getBoundingClientRect().bottom
		position -= this.scroller.scrollTop
		this.updateSliderPosition('bottom', position)

		updateData()
		await untilRenderComplete()
	}
}