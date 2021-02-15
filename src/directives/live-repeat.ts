import {defineDirective, Directive, DirectiveResult} from './define'
import type {Context} from '../component'
import {ContextualTransition, ContextualTransitionOptions} from '../internals/contextual-transition'
import {RepeativeTemplate, TemplateFn} from './helpers/repeative-template'
import type {NodeAnchor} from "../internals/node-anchor"
import {off, on} from '../internals/dom-event'
import {UpdatableOptions} from '../internals/updatable-options'
import {PartialRenderingProcessor} from './helpers/partial-rendering-processor'
import {InternalEventEmitter} from '../internals/internal-event-emitter'
import {GlobalWatcherGroup, LazyWatcher, Watcher} from '../watchers'
import {EditType, getEditRecord} from '../helpers/edit'
import {locateFirstVisibleIndex} from './helpers/visible-index-locator'
import {untilIdle} from '../helpers/utils'
import {enqueueUpdatable, onRenderComplete} from '../queue'


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
	pageSize?: number

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
	pageSize: 50,
	preRendering: false,
}


export class LiveRepeatDirective<T, E = any> extends InternalEventEmitter<LiveRepeatEvents<T> & E> implements Directive {

	protected readonly anchor: NodeAnchor
	protected readonly context: Context
	protected readonly transition: ContextualTransition
	protected readonly options: UpdatableOptions<LiveRepeatOptions> = new UpdatableOptions(DefaultLiveRepeatOptions)
	protected readonly processor: PartialRenderingProcessor
	protected readonly scroller: HTMLElement
	protected readonly slider: HTMLElement


	/** Cached last data that comes from outside, before been processed. */
	protected rawData: Iterable<T> | null = null

	/** Full data. */
	protected fullData: T[] = []

	/** Current rendered part of data. */
	protected liveData: T[] = []

	/** Current rendered templates, maps with `lastData` one by one. */
	protected repTems: RepeativeTemplate<T>[] = []

	/** Watcher to watch data changes. */
	protected lastWatcher: Watcher | null = null

	/** Function to generate template result from each repeat item. */
	protected templateFn!: TemplateFn<T>


	/** The start index of first item in the whole data. */
	protected startIndex: number = 0

	/** The end index of next position of last item in the whole data. */
	protected endIndex: number = 0

	/** All current items and pre-prendered items. */
	protected preRendered: Map<T, RepeativeTemplate<T>> | null = null

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
		this.processor = new PartialRenderingProcessor(slider, scroller, this.options.get('pageSize'))
		this.scroller = scroller
		this.slider = slider

		on(scroller, 'scroll.passive', this.onScroll, this)
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

		if (data !== this.rawData) {
			this.watchAndUpdateData(data)
			this.rawData = data
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

		let watcher = new LazyWatcher(watchFn, onUpdate, this.context)
		this.getWatcherGroup().add(watcher)
		onUpdate(watcher.value)
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
		// Update after watchers and components updated.
		enqueueUpdatable(this, this.context)
	}

	__updateImmediately() {
		this.processor.updateDataCount(this.fullData.length)
		this.processor.updateAlways(this.updateFromIndices.bind(this))
	}

	protected onScroll() {
		this.processor.updateSmoothlyIfNeeded(this.updateFromIndices.bind(this))
	}

	protected updateFromIndices(startIndex: number, endIndex: number, scrollDirection: 'up' | 'down' | null) {
		this.startIndex = startIndex
		this.endIndex = endIndex
		this.updateLiveData(this.fullData.slice(startIndex, endIndex), scrollDirection)
		this.triggerLiveDataEvents(scrollDirection)		
	}

	protected updateLiveData(liveData: T[], scrollDirection: 'up' | 'down' | null) {
		this.updateVersion++

		let shouldPaly = this.transition.canPlay()
		let shouldReuse = !shouldPaly && !this.options.get('preRendering')
		let oldData = this.liveData
		let oldRepTems = this.repTems
		let editRecord = getEditRecord(oldData, liveData, shouldReuse)

		this.liveData = liveData
		this.repTems = []

		for (let record of editRecord) {
			let {type, fromIndex, toIndex, moveFromIndex} = record
			let oldRepTem = fromIndex < oldRepTems.length && fromIndex !== -1 ? oldRepTems[fromIndex] : null

			if (type === EditType.Leave) {
				this.useMatchedRepTem(oldRepTem!, toIndex)
			}
			else if (type === EditType.Move) {
				this.moveRepTemBefore(oldRepTems[moveFromIndex], oldRepTem)
				this.useMatchedRepTem(oldRepTems[moveFromIndex], toIndex)
			}
			else if (type === EditType.MoveModify) {
				this.moveRepTemBefore(oldRepTems[moveFromIndex], oldRepTem)
				this.reuseRepTem(oldRepTems[moveFromIndex], oldData[moveFromIndex], toIndex)
			}
			else if (type === EditType.Insert) {
				let newRepTem = this.createRepTem(liveData[toIndex], toIndex)
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

	protected moveRepTemBefore(repTem: RepeativeTemplate<T>, nextOldRepTem: RepeativeTemplate<T> | null) {
		if (nextOldRepTem) {
			nextOldRepTem.template.before(repTem.template)
		}
		else {
			this.anchor.insert(repTem.template.extractToFragment())
		}
	}

	protected useMatchedRepTem(repTem: RepeativeTemplate<T>, index: number) {
		repTem.updateIndex(this.startIndex + index)
		this.repTems.push(repTem)
	}

	protected reuseRepTem(repTem: RepeativeTemplate<T>, item: T, index: number) {
		this.preRendered?.delete(repTem.item)
		this.preRendered?.set(item, repTem)

		repTem.update(item, this.startIndex + index)
		this.repTems.push(repTem)
	}

	protected createRepTem(item: T, index: number) {
		if (this.preRendered?.has(item)) {
			let repTem = this.preRendered.get(item)!
			repTem.connect()

			return repTem
		}
		else {
			let repTem = new RepeativeTemplate(this.context, this.templateFn, item, this.startIndex + index)
			this.repTems.push(repTem)
			this.preRendered?.set(item, repTem)

			return repTem
		}
	}

	protected mayPlayEnter(repTem: RepeativeTemplate<T>) {
		let template = repTem.template
		let firstElement = template.getFirstElement() as HTMLElement
		if (firstElement) {
			this.transition.playEnter(firstElement)
		}
	}

	protected removeRepTemAndMayPlayLeave(repTem: RepeativeTemplate<T>, shouldPaly: boolean) {
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

	protected removeRepTem(repTem: RepeativeTemplate<T>) {
		repTem.disconnect()
	}

	/** Get `startIndex` for the start index of current rendered items. */
	getStartIndex() {
		return this.startIndex
	}

	/** 
	 * Get the index of the first visible element, which can be used to restore scrolling position by `setStartIndex`.
	 * May cause page reflow.
	 */
	getFirstVisibleIndex() {
		return Math.max(0, locateFirstVisibleIndex(this.scroller, this.slider.children))
	}

	/** Set `startIndex`, and the item in which index will be at the top start position of the viewport. */
	setStartIndex(index: number) {
		this.processor.setStartIndex(index)
		this.update()
	}

	/** Adjust `startIndex` and scroll position to make item in the specified index becomes visible if it's not. */
	scrollToViewIndex(index: number) {
		if (this.isIndexRendered(index)) {
			this.scrollToViewRenderedIndex(index)
		}
		else {
			this.setStartIndex(index)
			
			if (this.isIndexRendered(index)) {
				this.scrollToViewRenderedIndex(index)
			}
		}
	}

	/** Get if item with specified index is rendered. */
	protected isIndexRendered(index: number) {
		return index >= this.startIndex && index < this.startIndex + this.liveData.length
	}

	/** After item in index rendered, make it visible. */
	protected scrollToViewRenderedIndex(index: number) {
		let scrollerRect = this.scroller.getBoundingClientRect()
		let el = this.slider.children[index - this.startIndex]!
		let rect = el.getBoundingClientRect()

		// Below it, need to scroll up.
		if (rect.bottom > scrollerRect.bottom) {
			this.scroller.scrollTop = this.scroller.scrollTop + (scrollerRect.bottom - rect.bottom)
		}

		// Above it, need to scroll down.
		else if (rect.top < scrollerRect.top) {
			this.scroller.scrollTop = this.scroller.scrollTop + (scrollerRect.top - rect.top)
		}
	}

	// Handle pre rendering
	protected async doPreRendering(scrollDirection: 'up' | 'down' | null) {
		let version = this.updateVersion
		let preRendered = this.preRendered!

		let renderCount = this.options.get('pageSize') * this.processor.getRenderPageCount()
		let startIndex = Math.max(0, this.startIndex - renderCount)
		let endIndex = Math.min(this.fullData.length, this.endIndex + renderCount)
		let data = this.fullData.slice(startIndex, endIndex)
		let dataSet: Set<T> = new Set(data)
		let indices: number[] = []
		let restRepTems: RepeativeTemplate<T>[] = []

		for (let item of preRendered.keys()) {
			if (!dataSet.has(item)) {
				let repTem = preRendered.get(item)!
				restRepTems.push(repTem)
				preRendered.delete(item)
			}
		}

		if (scrollDirection === 'down' || scrollDirection === null) {
			for (let i = this.endIndex; i < endIndex; i++) {
				indices.push(i)
			}

			for (let i = this.startIndex - 1; i >= startIndex; i--) {
				indices.push(i)
			}
		}
		else {
			for (let i = this.startIndex - 1; i >= startIndex; i--) {
				indices.push(i)
			}

			for (let i = this.endIndex; i < endIndex; i++) {
				indices.push(i)
			}
		}

		let createCount = 0

		for (let index of indices) {
			let item = data[index]

			if (preRendered.has(item)) {
				continue
			}

			if (restRepTems.length > 0) {
				let repTem = restRepTems.pop()!
				repTem.update(item, index)
				preRendered.set(item, repTem)
			}
			else {
				let repTem = new RepeativeTemplate(this.context, this.templateFn, item, index)
				repTem.template.preRender()
				preRendered.set(item, repTem)
				createCount++
			}

			if (createCount % 15 === 0) {
				await untilIdle()

				if (this.updateVersion !== version) {
					return
				}
			}
		}
	}

	remove() {
		this.tryDeleteLastWatcher()

		off(this.scroller, 'scroll.passive', this.onScroll, this)

		// Pre-rendering items are not connected, no need to remove them.
		for (let wtem of this.repTems) {
			wtem.disconnect()
		}
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
