import {defineDirective, Directive, DirectiveResult} from './define'
import type {Context} from '../component'
import {ContextualTransition, ContextualTransitionOptions} from '../internals/contextual-transition'
import {RepetitiveTemplate, RepetitiveTemplateSource, TemplateFn} from './helpers/repetitive-template'
import {NodeAnchor} from "../internals/node-anchor"
import {GlobalWatcherGroup, LazyWatcher, Watcher} from '../watchers'
import {getEditRecord, EditType} from '../helpers/edit'
import {getClosestScrollWrapper} from '../helpers/utils'
import {untilRenderComplete} from '../queue'


/** 
 * `repeat` directive doesn't watches the dependencies when updating a component,
 * instead, it watches dependencies when updating each item,
 * and update each item indenpent after it's dependencies changed.
 */
export class RepeatDirective<T> implements Directive, RepetitiveTemplateSource<T> {

	protected readonly anchor: NodeAnchor
	protected readonly context: Context
	protected readonly transition: ContextualTransition

	/** Cached last data that comes from outside, before been processed. */
	protected rawData: Iterable<T> | null = null

	/** Current rendered data. */
	protected data: T[] = []

	/** Current rendered templates, maps with `lastData` one by one. */
	protected repTems: RepetitiveTemplate<T>[] = []

	/** Watcher to watch data changes. */
	protected lastWatcher: Watcher | null = null

	/** Function to generate template result from each repeat item. */
	protected templateFn!: TemplateFn<T>

	constructor(anchor: NodeAnchor, context: Context) {
		this.anchor = anchor		
		this.context = context
		this.transition = new ContextualTransition(context)
	}

	canMergeWith(_data: Iterable<T> | null, templateFn: TemplateFn<T>): boolean {
		
		// Compare string of two functions should be fast:
		// string  of function represent as a fixed sring,
		// and strings will compare by hash, not per character.
		return templateFn === this.templateFn || templateFn.toString() === this.templateFn.toString()
	}

	merge(data: Iterable<T> | null, templateFn: TemplateFn<T>, options?: ContextualTransitionOptions) {
		this.templateFn = templateFn
		this.transition.updateOptions(options)

		// Outer components update frequently,
		// Data has a high rate that not been updated.
		// So here we don't rerender except really found data changes from a inner watcher.
		if (data !== this.rawData) {
			this.watchAndUpdateData(data)
			this.rawData = data
		}
		else if (this.lastWatcher) {
			this.updateData(this.data)
		}
	}

	protected watchAndUpdateData(data: Iterable<T> | null) {
		this.tryDeleteLastWatcher()

		if (!data) {
			this.updateData([])
			return
		}

		// Here read each item of the `Iterable<T>` so we can observe changes like `a[i] = xxx`.
		// Other, here will observe each item of data.
		let watchFn = () => {
			return [...data]
		}

		// Uses lazy watcher to watch each item of data changes,
		// So each item can be updated indepent,
		// and can also avoid unnecessary updating after total directive data updated.
		this.lastWatcher = new LazyWatcher(watchFn, this.updateData.bind(this), this.context)
		this.getWatcherGroup().add(this.lastWatcher)
		this.updateData(this.lastWatcher.value)
	}

	/** Get watcher group to add watcher. */
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

	protected updateData(newData: T[]) {
		let shouldPaly = this.transition.canPlay()
		let shouldReuse = !shouldPaly
		let oldData = this.data
		let oldRepTems = this.repTems
		let editRecord = getEditRecord(oldData, newData, shouldReuse)

		this.data = newData
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
		// Must update even reuse matched item,
		// Because scoped variables may changed.
		repTem.update(item, index)
		this.repTems.push(repTem)
	}

	protected reuseRepTem(repTem: RepetitiveTemplate<T>, item: T, index: number) {
		repTem.update(item, index)
		this.repTems.push(repTem)
	}

	protected createRepTem(item: T, index: number) {
		let repTem = new RepetitiveTemplate(this, item, index)
		this.repTems.push(repTem)

		return repTem
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

	remove() {
		this.tryDeleteLastWatcher()

		for (let repTem of this.repTems) {
			repTem.remove()
		}
	}

	/** 
	 * Make item in the specified index becomes visible by scrolling minimum pixels in Y direction.
	 * Try to adjust immediately, so you will need to ensure elements rendered.
	 */
	makeIndexVisible(index: number): boolean {
		let el = this.repTems[index]?.template.getFirstElement() as HTMLElement | null
		if (!el) {
			return false
		}

		let scroller = getClosestScrollWrapper(el)
		if (!scroller) {
			return false
		}

		let scrollerRect = scroller.getBoundingClientRect()
		let elRect = el.getBoundingClientRect()

		// Below it, need to scroll up.
		if (elRect.bottom > scrollerRect.bottom) {
			scroller.scrollTop = scroller.scrollTop + (elRect.bottom - scrollerRect.bottom)
		}

		// Above it, need to scroll down.
		else if (elRect.top < scrollerRect.top) {
			scroller.scrollTop = scroller.scrollTop + (scrollerRect.top - elRect.top)
		}

		return true
	}

	/** 
	 * Make item in the specified index visible at the top edge of scroller.
	 * Try to adjust immediately, so you will need to ensure elements rendered.
	 */
	 makeIndexVisibleAtTop(index: number): boolean {
		let el = this.repTems[index]?.template.getFirstElement() as HTMLElement | null
		if (!el) {
			return false
		}

		let scroller = getClosestScrollWrapper(el)
		if (!scroller) {
			return false
		}

		let scrollerRect = scroller.getBoundingClientRect()
		let elRect = el.getBoundingClientRect()

		scroller.scrollTop = scroller.scrollTop + (elRect.top - scrollerRect.top)

		return true
	}

	/** 
	 * Make item in the specified index becomes visible at the top scroll position.
	 * If needs to update, will update firstly and then set index.
	 */
	async setFirstVisibleIndex(index: number): Promise<boolean> {
		await untilRenderComplete()

		let el = this.repTems[index]?.template.getFirstElement() as HTMLElement | null
		if (!el) {
			return false
		}

		let scroller = getClosestScrollWrapper(el)
		if (!scroller) {
			return false
		}

		let scrollerRect = scroller.getBoundingClientRect()
		let elRect = el.getBoundingClientRect()

		scroller.scrollTop = scroller.scrollTop + (elRect.top - scrollerRect.top)

		return true
	}

	getContext() {
		return this.context
	}

	getTemplateFn() {
		return this.templateFn
	}
}


/**
 * `repeat(items, () => html`...`, ?options)` gerenates repeated elements,
 * and will reuse elements as much as possible when data changed.
 * Currently the repeat directive reuses rendered elements by data objects, no `key` can be specified.
 * If you do need to reuse elements by a `key`, try repeat the `key` values.
 * 
 * @param items The iterable data, each item in it will pass to `templateFn`.
 * @param templateFn The fucntion which will return a template from one iterable data item and index position.
 * @param options The transition options, it can be a transition name, property or properties, or {transition, enterAtStart}.
 */
export const repeat = defineDirective(RepeatDirective) as <T>(items: Iterable<T> | null, templateFn: TemplateFn<T>, options?: ContextualTransitionOptions) => DirectiveResult
