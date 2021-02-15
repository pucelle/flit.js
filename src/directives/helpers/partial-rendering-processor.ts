import {onRenderComplete} from "../../queue"
import {locateFirstVisibleIndex, locateLastVisibleIndex} from "./visible-index-locator"


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

	/** Size of each page. */
	private readonly pageSize: number

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
	private dataCountNeedsToApply: boolean = false

	/** Render count of pages, increase if not enough. */
	private renderPageCount: number = 1

	/** 
	 * Average item height in pixels, it is used to calculate the position of the `slider`.
	 * It will be detected automatically from the first rendering if was not initialized.
	 */
	private averageItemHeight: number = 0

	constructor(slider: HTMLElement, scroller: HTMLElement, pageSize: number) {
		this.slider = slider
		this.scroller = scroller
		this.pageSize = pageSize

		this.palceholder = document.createElement('div')
		this.palceholder.style.cssText = 'position: absolute; left: 0; top: 0; width: 1px; visibility: hidden;'
		this.scroller.prepend(this.palceholder)
		
		onRenderComplete(() => {
			this.onFirstTimeRenderCompleted()
		})
	}

	/** Get how many pages need to render. */
	getRenderPageCount() {
		return this.renderPageCount
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

	/** Update total data count. */
	updateDataCount(dataCount: number) {
		if (dataCount !== this.totalDataCount) {
			this.totalDataCount = dataCount
			this.dataCountNeedsToApply = true
		}
	}

	/** Update from applied start index or current scroll position. */
	updateAlways(doDataUpdating: UpdatingFunction) {
		// Scroll to specified index.
		if (this.startIndexToApply !== null) {
			this.updateWhenStartIndexWillApply(doDataUpdating)
		}

		// Keep scroll position but update to different items.
		else {
			this.updateFromCurrentScrollOffset(doDataUpdating)
		}
	}

	/** Re-generate indices from current scroll offset. */
	private updateFromCurrentScrollOffset(doDataUpdating: UpdatingFunction) {
		this.resetIndices()
		this.resetSliderPosition()

		doDataUpdating(this.startIndex, this.endIndex, null)
	}

	/** 
	 * Update only when slider can't cover scroller, and also keep continuous scroll position.
	 * Returns whether updated.
	 */
	updateSmoothlyIfNeeded(doDataUpdating: UpdatingFunction): boolean {
		let updated = this.updateFromCoverage(doDataUpdating)
		if (updated) {
			this.updatePlaceholderHeight()
		}

		return updated
	}

	/** Update when start index specified. */
	private updateWhenStartIndexWillApply(doDataUpdating: UpdatingFunction) {
		this.updateIndices(this.startIndexToApply!)
		this.startIndexToApply = null
		this.resetSliderPosition()

		doDataUpdating(this.startIndex, this.endIndex, null)

		// Check rendering heights.
		if (!this.averageItemHeight && this.totalDataCount > 0) {
			this.measureRenderingHeights()

			// Re-calcuate position and scroll offset.
			if (this.startIndex > 0) {
				this.resetSliderPosition()
				this.updateScrollOffset()
			}
		}
		else {
			this.updateScrollOffset()
		}

		// `updateScrollOffset` will trigger scroll event, so no need to validate coverage.
	}

	/** Update start and end index before rendering. */
	private updateIndices(startIndex: number) {
		let renderCount = this.pageSize * this.renderPageCount

		startIndex = Math.min(startIndex, this.totalDataCount - renderCount)
		startIndex = Math.max(0, startIndex)

		let endIndex = startIndex + renderCount
		endIndex = Math.max(0, this.totalDataCount)

		this.startIndex = startIndex
		this.endIndex = endIndex
	}

	/** Reset indices from current scroll offset. */
	private resetIndices() {
		let newStartIndex = Math.floor(this.scroller.scrollTop / this.averageItemHeight)
		this.updateIndices(newStartIndex)
	}

	/** Update height of placeholder. */
	private updatePlaceholderHeight() {
		if (this.dataCountNeedsToApply) {
			this.palceholder.style.height = this.averageItemHeight * this.totalDataCount + 'px'
			this.dataCountNeedsToApply = false
		}
	}

	/** Update position of `slider` after set new indices. */
	private updateSliderPosition(renderDirection: 'up' | 'down', position: number) {
		if (renderDirection === 'down') {
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
		
		this.updateSliderPosition('down', newTop)
	}

	/** Update scroll offset of `scroller` after set new `startIndex`. */
	private updateScrollOffset() {
		let countBeforeStart = this.startIndex
		this.scroller.scrollTop = this.averageItemHeight * countBeforeStart
	}

	/** Measure to get a not 100% precise average item height. */
	private measureRenderingHeights() {
		let sliderHeight = this.slider.offsetHeight
		if (!sliderHeight) {
			return
		}

		this.averageItemHeight = Math.round(sliderHeight / (this.endIndex - this.startIndex))

		if (this.averageItemHeight) {
			this.renderPageCount = Math.ceil(sliderHeight / this.averageItemHeight / this.pageSize)
		}
	}

	/** 
	 * Validate if slider fully covers scroller and update indices if not.
	 * Returns whether updated indices.
	 */
	updateFromCoverage(doDataUpdating: UpdatingFunction): boolean {
		let scrollerRect = this.scroller.getBoundingClientRect()
		let sliderRect = this.slider.getBoundingClientRect()
		let renderCount = this.pageSize * this.renderPageCount

		// No intersection, reset slider position from current slider scroll offset.
		let hasNoIntersection = sliderRect.bottom < scrollerRect.top || sliderRect.top > scrollerRect.bottom
		if (hasNoIntersection) {
			this.updateFromCurrentScrollOffset(doDataUpdating)
		}

		// Scroll down and can't cover at top direction.
		// Keeps last visible index as endIndex.
		// Otherwise will still load more when touch top scrolling edge and still more data exist.
		else if (sliderRect.top > scrollerRect.top || sliderRect.top === scrollerRect.top && this.startIndex > 0) {
			let lastVisibleIndex = locateLastVisibleIndex(this.scroller, this.slider.children)
			let oldStartIndex = this.startIndex
			let newEndIndex = this.startIndex + lastVisibleIndex + 1
			let newStartIndex = newEndIndex - renderCount

			this.updateIndices(newStartIndex)
			this.keepSliderPositionStable('down', oldStartIndex, scrollerRect, sliderRect)

			doDataUpdating(this.startIndex, this.endIndex, 'down')
		}

		// Can't cover at bottom direction.
		// Otherwise will still load more when touch bottom scrolling edge and still more data exist.
		else if (sliderRect.bottom < scrollerRect.bottom || sliderRect.bottom === scrollerRect.bottom && this.endIndex < this.totalDataCount) {
			let firstVisibleIndex = locateFirstVisibleIndex(this.scroller, this.slider.children)
			let oldStartIndex = this.startIndex
			let newStartIndex = this.startIndex + firstVisibleIndex
	
			this.updateIndices(newStartIndex)
			this.keepSliderPositionStable('up', oldStartIndex, scrollerRect, sliderRect)

			doDataUpdating(this.startIndex, this.endIndex, 'up')
		}

		// No need to update.
		else {
			return false
		}

		return true
	}

	/** Update slider position to keep it in a stable position after updating items. */
	protected keepSliderPositionStable(scrollDirection: 'up' | 'down', oldStartIndex: number, scrollerRect: DOMRect, sliderRect: DOMRect) {
		let visibleElementIndex = (scrollDirection === 'down' ? this.endIndex - 1 : this.startIndex) - oldStartIndex
		let visibleElement = this.slider.children[visibleElementIndex]
		let position: number

		// Keeps visible element in the same top position.
		if (scrollDirection === 'down') {
			position = this.getSliderTopPosition(scrollerRect, sliderRect)
			position += visibleElement.getBoundingClientRect().top - sliderRect.top
		}
		else {
			position = this.getSliderBottomPosition(scrollerRect, sliderRect)
			position += visibleElement.getBoundingClientRect().bottom - sliderRect.bottom
		}

		this.updateSliderPosition(scrollDirection, position)
	}

	/** Get slider top position, relative to the top of whole scrolling area in scroller. */
	protected getSliderTopPosition(scrollerRect: DOMRect, sliderRect: DOMRect) {
		let scrollerPaddingAreaTop = scrollerRect.top - this.scrollerBorderTopWidth!
		return sliderRect.top - scrollerPaddingAreaTop + this.scroller.scrollTop
	}

	/** Get slider bottom position, relative to the bottom of whole scrolling area in scroller. */
	protected getSliderBottomPosition(scrollerRect: DOMRect, sliderRect: DOMRect) {
		let scrollerPaddingAreaBottom = scrollerRect.bottom + this.scrollerBorderBottomWidth
		return sliderRect.bottom - scrollerPaddingAreaBottom + this.scroller.scrollTop
	}
}