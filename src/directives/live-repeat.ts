import {defineDirective, Directive, DirectiveResult} from './define'
import type {Context} from '../component'
import {ContextualTransition, ContextualTransitionOptions} from '../internals/contextual-transition'
import {RepetitiveTemplate, RepetitiveTemplateSource, TemplateFn} from './helpers/repetitive-template'
import type {NodeAnchor} from "../internals/node-anchor"
import {off, on} from '../internals/dom-event'
import {UpdatableOptions} from '../internals/updatable-options'
import {PartialRenderingProcessor} from './helpers/partial-rendering-processor'
import {InternalEventEmitter} from '../internals/internal-event-emitter'
import {GlobalWatcherGroup, LazyWatcher, Watcher} from '../watchers'
import {EditType, getEditRecord} from '../helpers/edit'
import {untilIdle, locateFirstVisibleIndex, locateLastVisibleIndex, getElementCountBefore} from '../helpers/utils'
import {enqueueUpdatableInOrder, onRenderComplete} from '../queue'
import {OffsetChildren} from './helpers/offset-children'
import {UpdatableUpdateOrder} from '../queue/helpers/updatable-queue'


export interface LiveRepeatOptions {

	/**
	* How many items to render each time.
	* If you are using dynamic data, you should set this value to the count of items that you ajax interface returned.
	* Otherwise you may set this value big enough to cover viewport, but should not too big to render too much items.
	* Normally `50` would be enough since minimal lineHeight is `24` and `24 * 50 = 1200` can cover most screens.
	* If the render result can't cover the viewport, it will render more pages until it can and do re-rendering.
    *
	* This property is not updatable.
	*/
	renderCount?: number

	/**
	* If can't render all the contents in an animation frame, you should set this to `true`.
	* It will prerender more contents before and after current contents so scrolling will becomes more smooth.
	*
	* This property is not updatable.
	*/
	preRendering?: boolean
}


export interface LiveRepeatEvents<T> {

	/** 
	 * Trigger after every time live data updated.
	 * Note elements are not rendered yet, if you'd want, just uses `liveDataRendered` event.
	 */
	liveDataUpdated: (liveData: T[], startIndex: number, scrollDirection: 'up' | 'down') => void

	/** Trigger after every time live data updated and rendered. */
	liveDataRendered: (liveData: T[], startIndex: number, scrollDirection: 'up' | 'down') => void
}


/** Default `liveRepeat` options. */
const DefaultLiveRepeatOptions: LiveRepeatOptions = {
	renderCount: 50,
	preRendering: false,
}


export class LiveRepeatDirective<T, E = any> extends InternalEventEmitter<LiveRepeatEvents<T> & E> implements Directive, RepetitiveTemplateSource<T> {

	protected readonly anchor: NodeAnchor
	protected readonly context: Context
	protected readonly transition: ContextualTransition
	protected readonly options: UpdatableOptions<LiveRepeatOptions> = new UpdatableOptions(DefaultLiveRepeatOptions)
	protected readonly processor: PartialRenderingProcessor
	protected readonly scroller: HTMLElement
	protected readonly slider: HTMLElement
	protected readonly sliderChildren: OffsetChildren
	protected readonly observer: any


	/** Cached last data that comes from outside, before been processed. */
	protected rawData: Iterable<T> | null = null

	/** Full data. */
	protected fullData: T[] = []

	/** Current rendered part of data. */
	protected liveData: T[] = []

	/** Current rendered templates, maps with `lastData` one by one. */
	protected repTems: RepetitiveTemplate<T>[] = []

	/** Watcher to watch data changes. */
	protected lastWatcher: Watcher | null = null

	/** Function to generate template result from each repeat item. */
	protected templateFn!: TemplateFn<T>


	/** The start index of first item in the whole data. */
	protected startIndex: number = 0

	/** The end index of next position of last item in the whole data. */
	protected endIndex: number = 0

	/** All current items and pre-prendered items. */
	protected preRendered: Map<T, RepetitiveTemplate<T>> | null = null

	/** Indicates current updating. */
	protected updateVersion: number = 0


	constructor(anchor: NodeAnchor, context: Context) {
		super()

		this.anchor = anchor		
		this.context = context

		let slider = this.anchor.el.parentElement!
		let scroller = slider.parentElement!

		if (!slider || !scroller || scroller.children.length !== 1) {
			throw new Error(`"liveRepeat" must be contained in the HTML struct like \`
				<div title="as a scroll parent" style="overflow: auto | scroll; position: relative;">
					<div title="as a scroll slider" style="position: absolute;">
						\${liveRepeat(...)}
					</div>
				</div>
			\`!`)
		}

		this.transition = new ContextualTransition(context)
		this.sliderChildren = new OffsetChildren(slider, getElementCountBefore(anchor.el as Comment))
		this.processor = new PartialRenderingProcessor(scroller, slider, this.sliderChildren)
		this.scroller = scroller
		this.slider = slider

		on(scroller, 'scroll.passive', this.checkCoverage, this)
		
		let ResizeObserver = (window as any).ResizeObserver
		if (ResizeObserver) {
			this.observer = new ResizeObserver(this.checkCoverage.bind(this))
			this.observer.observe(this.scroller)
		}
		else {
			on(window, 'resize', this.checkCoverage, this)
		}
	}

	canMergeWith(_data: Iterable<T> | null, templateFn: TemplateFn<T>): boolean {
		return templateFn === this.templateFn || templateFn.toString() === this.templateFn.toString()
	}

	merge(
		data: Iterable<T> | null,
		templateFn: TemplateFn<T>,
		liveRepeatOptions?: LiveRepeatOptions,
		transitionOptions?: ContextualTransitionOptions
	) {
		this.templateFn = templateFn
		this.options.update(liveRepeatOptions)
		this.transition.updateOptions(transitionOptions)
		this.updatePreRendered()

		if (liveRepeatOptions?.renderCount) {
			this.processor.updateRenderCount(liveRepeatOptions.renderCount)
		}

		if (data !== this.rawData) {
			this.watchAndUpdateData(data)
			this.rawData = data
		}
		else if (this.lastWatcher) {
			this.update()
		}
	}

	protected updatePreRendered() {
		if (this.options.get('preRendering') && !this.preRendered) {
			this.preRendered = new Map()
		}
		else if (!this.options.get('preRendering') && this.preRendered) {
			this.preRendered = null
		}
	}

	protected watchAndUpdateData(data: Iterable<T> | null) {
		this.tryDeleteLastWatcher()

		if (!data) {
			this.fullData = []
			return
		}

		let watchFn = () => {
			return [...data]
		}

		let onUpdate = (data: T[]) => {
			this.fullData = data
			this.update()
		}

		this.lastWatcher = new LazyWatcher(watchFn, onUpdate, this.context)
		this.getWatcherGroup().add(this.lastWatcher)
		onUpdate(this.lastWatcher.value)
	}

	/** Get watcher group to add or delete watcher. */
	protected getWatcherGroup() {
		return this.context?.__getWatcherGroup() || GlobalWatcherGroup
	}

	/** If have, delete last registered watcher. */
	protected tryDeleteLastWatcher() {
		if (this.lastWatcher) {
			this.getWatcherGroup().delete(this.lastWatcher)
			this.lastWatcher = null
		}
	}

	/** Serveral update entry: normal update; from `setStartIndex`, from `reload`. */
	protected update() {
		// Update after watchers and components.
		enqueueUpdatableInOrder(this, this.context, UpdatableUpdateOrder.Directive)
	}

	__updateImmediately() {
		this.processor.updateDataCount(this.fullData.length)
		this.processor.updateSynchronously(this.updateFromIndices.bind(this))
	}

	/** Returns a promise which will be resolved after data updated and renderer. */
	protected untilDataUpdatedAndRendered() {
		return new Promise(resolve => {
			this.once('liveDataRendered', resolve)
		})
	}

	protected checkCoverage() {
		this.processor.updateSmoothlyIfNeeded(this.updateFromIndices.bind(this))
	}

	protected updateFromIndices(startIndex: number, endIndex: number, scrollDirection: 'up' | 'down' | null) {
		this.startIndex = startIndex
		this.endIndex = endIndex
		this.updateLiveData(this.fullData.slice(startIndex, endIndex), scrollDirection)
		this.triggerLiveDataEvents(scrollDirection)		
	}

	protected updateLiveData(newData: T[], scrollDirection: 'up' | 'down' | null) {
		this.updateVersion++

		let shouldPaly = this.transition.canPlay()
		let shouldReuse = !shouldPaly && !this.options.get('preRendering')
		let oldData = this.liveData
		let oldRepTems = this.repTems
		let editRecord = getEditRecord(oldData, newData, shouldReuse)

		this.liveData = newData
		this.repTems = []

		for (let record of editRecord) {
			let {type, fromIndex, toIndex, moveFromIndex} = record
			let oldRepTem = fromIndex < oldRepTems.length && fromIndex !== -1 ? oldRepTems[fromIndex] : null
			let newItem = newData[toIndex]

			if (type === EditType.Leave) {
				this.useMatchedRepTem(oldRepTem!, newItem, toIndex)
			}
			else if (type === EditType.Move) {
				this.moveRepTemBefore(oldRepTems[moveFromIndex], oldRepTem)
				this.useMatchedRepTem(oldRepTems[moveFromIndex], newItem, toIndex)
			}
			else if (type === EditType.MoveModify) {
				this.moveRepTemBefore(oldRepTems[moveFromIndex], oldRepTem)
				this.reuseRepTem(oldRepTems[moveFromIndex], newItem, toIndex)
			}
			else if (type === EditType.Insert) {
				let newRepTem = this.createRepTem(newItem, toIndex)
				this.moveRepTemBefore(newRepTem, oldRepTem)
				
				if (shouldPaly) {
					this.mayPlayEnter(newRepTem)
				}
			}
			else if (type === EditType.Delete) {
				this.removeRepTemAndMayPlayLeave(oldRepTem!, shouldPaly)
			}
		}

		if (this.options.get('preRendering')) {
			untilIdle().then(() => {
				this.doPreRendering(scrollDirection)
			})
		}
	}

	protected triggerLiveDataEvents(scrollDirection: 'up' | 'down' | null) {
		this.emit('liveDataUpdated', this.liveData, this.startIndex, scrollDirection)

		onRenderComplete(() => {
			this.emit('liveDataRendered', this.liveData, this.startIndex, scrollDirection)
		})
	}

	protected moveRepTemBefore(repTem: RepetitiveTemplate<T>, nextOldRepTem: RepetitiveTemplate<T> | null) {
		if (nextOldRepTem) {
			nextOldRepTem.template.before(repTem.template)
		}
		else {
			this.anchor.insert(repTem.template.extractToFragment())
		}
	}

	protected useMatchedRepTem(repTem: RepetitiveTemplate<T>, item: T, index: number) {
		repTem.update(item, this.startIndex + index)
		this.repTems.push(repTem)
	}

	protected reuseRepTem(repTem: RepetitiveTemplate<T>, item: T, index: number) {
		this.preRendered?.delete(repTem.item)
		this.preRendered?.set(item, repTem)

		repTem.update(item, this.startIndex + index)
		this.repTems.push(repTem)
	}

	protected createRepTem(item: T, index: number) {
		if (this.preRendered?.has(item)) {
			let repTem = this.preRendered.get(item)!
			repTem.connect()
			repTem.update(item, index)
			this.repTems.push(repTem)

			return repTem
		}
		else {
			let repTem = new RepetitiveTemplate(this, item, this.startIndex + index)
			this.repTems.push(repTem)
			this.preRendered?.set(item, repTem)

			return repTem
		}
	}

	protected mayPlayEnter(repTem: RepetitiveTemplate<T>) {
		let template = repTem.template
		let firstElement = template.getFirstElement() as HTMLElement
		if (firstElement) {
			this.transition.playEnter(firstElement)
		}
	}

	protected removeRepTemAndMayPlayLeave(repTem: RepetitiveTemplate<T>, shouldPaly: boolean) {
		let template = repTem.template

		if (shouldPaly) {
			let firstElement = template.getFirstElement() as HTMLElement
			if (firstElement) {
				this.transition.playLeave(firstElement).then((finish: boolean) => {
					if (finish) {
						this.removeRepTem(repTem)
					}
				})
			}
			else {
				this.removeRepTem(repTem)
			}
		}
		else {
			this.removeRepTem(repTem)
		}
	}

	protected removeRepTem(repTem: RepetitiveTemplate<T>) {
		repTem.remove()
	}

	/** Get `startIndex` for the start index of current rendered items. */
	getStartIndex() {
		return this.startIndex
	}

	/** Set `startIndex`, and the item in this index will be at the top start position of the viewport. */
	setStartIndex(index: number) {
		this.processor.setStartIndex(index)
		this.update()
	}

	/** 
	 * Get `endIndex` for the end index of current rendered items.
	 * The returned value equals index of last index of rendered item +1.
	 */
	getEndIndex() {
		return this.startIndex
	}

	/** 
	 * Get the index of the first visible element, which can be used to restore scrolling position by `setFirstVisibleIndex`.
	 * May cause page reflow.
	 */
	getFirstVisibleIndex() {
		return Math.max(0, locateFirstVisibleIndex(this.scroller, this.sliderChildren.getChildren())) + this.startIndex
	}

	/** Set the index of the first visible element, used to restore scrolling position. */
	setFirstVisibleIndex(index: number) {
		this.processor.setStartIndex(index)
		this.update()
	}

	/** 
	 * Get the index of the last visible element.
	 * May cause page reflow.
	 */
	getLastVisibleIndex() {
		return Math.max(0, locateLastVisibleIndex(this.scroller, this.sliderChildren.getChildren()))
	}

	/** 
	 * Make item in the specified index becomes visible by scrolling minimum pixels.
	 * If element is not rendered, adjust `startIndex` and re-render firstly.
	 */
	scrollToViewIndex(index: number) {
		if (this.isIndexRendered(index)) {
			this.scrollToViewRenderedIndex(index)
		}
		else {
			this.setStartIndex(index)
			
			this.untilDataUpdatedAndRendered().then(() => {
				this.scrollToViewRenderedIndex(index)
			})
		}
	}

	/** Get if item with specified index is rendered. */
	protected isIndexRendered(index: number) {
		return index >= this.startIndex && index < this.startIndex + this.liveData.length
	}

	/** After item in index rendered, make it visible. */
	protected scrollToViewRenderedIndex(index: number) {
		let scrollerRect = this.scroller.getBoundingClientRect()
		let el = this.sliderChildren.childAt(index - this.startIndex)
		let elRect = el.getBoundingClientRect()

		// Below it, need to scroll up.
		if (elRect.bottom > scrollerRect.bottom) {
			this.scroller.scrollTop = this.scroller.scrollTop + (elRect.bottom - scrollerRect.bottom)
		}

		// Above it, need to scroll down.
		else if (elRect.top < scrollerRect.top) {
			this.scroller.scrollTop = this.scroller.scrollTop + (scrollerRect.top - elRect.top)
		}
	}

	/** 
	 * Make item in the specified index becomes visible at the top scroll position.
	 * If element is not rendered, adjust `startIndex` and re-render firstly.
	 */
	scrollToMakeIndexAtTop(index: number) {
		if (this.isIndexRendered(index)) {
			this.scrollToMakeRenderedIndexAtTop(index)
		}
		else {
			this.setStartIndex(index)
			
			this.untilDataUpdatedAndRendered().then(() => {
				this.scrollToMakeRenderedIndexAtTop(index)
			})
		}
	}

	/** After item in index rendered, make it becomes visible at the top scroll position. */
	protected scrollToMakeRenderedIndexAtTop(index: number) {
		let scrollerRect = this.scroller.getBoundingClientRect()
		let el = this.sliderChildren.childAt(index - this.startIndex)
		let elRect = el.getBoundingClientRect()

		this.scroller.scrollTop = this.scroller.scrollTop + (elRect.top - scrollerRect.top)
	}

	/** Handle pre-rendering */
	protected async doPreRendering(scrollDirection: 'up' | 'down' | null) {
		let version = this.updateVersion
		let preRendered = this.preRendered!

		// Determine the maximum range that need to pre-render, must include current range.
		let renderCount = this.options.get('renderCount') * this.processor.getRenderGroupCount()
		let startIndex = Math.max(0, this.startIndex - renderCount)
		let endIndex = Math.min(this.fullData.length, this.endIndex + renderCount)

		// The data and global indices that should be pre-rendered.
		let data = this.fullData.slice(startIndex, endIndex)
		let dataSet: Set<T> = new Set(data)
		let indices: number[] = []
		let restRepTems: RepetitiveTemplate<T>[] = []

		// Rlease items out of maximun range.
		for (let item of preRendered.keys()) {
			if (!dataSet.has(item)) {
				let repTem = preRendered.get(item)!
				repTem.disconnect()
				restRepTems.push(repTem)
				preRendered.delete(item)
			}
		}

		// If scrolling down, only pre-render items below.
		if (scrollDirection === 'down' || scrollDirection === null) {
			for (let i = this.endIndex; i < endIndex; i++) {
				indices.push(i)
			}
		}
		else {
			for (let i = startIndex; i < this.startIndex; i++) {
				indices.push(i)
			}
		}

		let createCount = 0

		for (let index of indices) {
			let item = this.fullData[index]

			if (preRendered.has(item)) {
				continue
			}

			if (restRepTems.length > 0) {
				let repTem = restRepTems.pop()!
				repTem.update(item, index)
				preRendered.set(item, repTem)
			}
			else {
				// Keep it disconnect, so it will not affect rendering performance and still have a rough render results.
				let repTem = new RepetitiveTemplate(this, item, index)
				repTem.disconnect()
				repTem.template.preRender()
				preRendered.set(item, repTem)
				createCount++
			}

			if (createCount % 15 === 0) {
				await untilIdle()

				if (this.updateVersion !== version) {
					break
				}
			}
		}
	}

	remove() {
		this.tryDeleteLastWatcher()

		off(this.scroller, 'scroll.passive', this.checkCoverage, this)

		if (this.observer) {
			this.observer.disconnect()
		}
		else {
			off(window, 'resize', this.checkCoverage, this)
		}

		// Pre-rendering items are not connected, no need to remove them.
		for (let repTem of this.repTems) {
			repTem.remove()
		}
	}

	getContext() {
		return this.context
	}

	getTemplateFn() {
		return this.templateFn
	}
}


/**
 * `liveRepeat(items, () => html`...`, ?liveRepeatOptions, ?transitionOptions)` gerenates partial elements only in current viewport,
 * and keeps re-rendering to cover current viewport after you scrolled.
 * 
 * Note the `liveRepeat` directive must be contained in the html struct like `
 *	 <div title="as a scroll parent" style="overflow: auto | scroll; position: relative;">
 *	    <div title="as a scroll slider" style="position: absolute;">
 *		  ${liveRepeat(...)}
 *	    </div>
 *   </div>`
 * 
 * @param items The iterable data, each item in it will pass to `templateFn`.
 * @param templateFn The fucntion which will return a template result from data item and index position. Rendered nodes must be contained in a container element.
 * @param liveRepeatOptions Options for live rendering.
 * @param transitionOptions The transition options, it can be a transition name, property or properties, or {transition, enterAtStart}.
 */
export const liveRepeat = defineDirective(LiveRepeatDirective) as <Item>(
	data: Iterable<Item>,
	templateFn: TemplateFn<Item>,
	liveRepeatOptions?: LiveRepeatOptions,
	transitionOptions?: ContextualTransitionOptions
) => DirectiveResult
