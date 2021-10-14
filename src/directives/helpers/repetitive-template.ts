import {Context} from '../../component'
import {Template, TemplateResult} from '../../template'
import {GlobalWatcherGroup, LazyWatcher} from '@pucelle/flit-basis'


export interface RepetitiveTemplateSource<T> {
	getContext: () => Context
	getTemplateFn: () => TemplateFn<T>
}

export type TemplateFn<T> = (item: T, index: number) => TemplateResult


/** 
 * A `repeat` directive can only watches top level data changes,
 * can't watch property changes of each `item`.
 * So this class is used to watch and update template result that generated from `templateFn` and one `item`.
 */
export class RepetitiveTemplate<T> {

	private readonly source: RepetitiveTemplateSource<T>
	private readonly watcher: LazyWatcher<TemplateResult>

	item: T
	index: number
	template: Template

	constructor(source: RepetitiveTemplateSource<T>, item: T, index: number) {
		this.source = source
		this.item = item
		this.index = index

		let context = source.getContext()
		
		// Update after components and top level watchers update completed,
		// and also after directive updated, or it will cause useless updating.
		this.watcher = new LazyWatcher(this.getTemplateResult.bind(this), this.onUpdateTemplateResult.bind(this), context)
		this.template = new Template(this.watcher.value, context)
		this.getWatcherGroup().add(this.watcher)
	}

	/** Get watcher group to add or delete watcher. */
	protected getWatcherGroup() {
		let context = this.source.getContext()
		return context?.__getWatcherGroup() || GlobalWatcherGroup
	}

	/** To get current template result for watching. */
	private getTemplateResult() {
		let templateFn = this.source.getTemplateFn()
		return templateFn(this.item, this.index)
	}

	/** After template result changed. */
	private onUpdateTemplateResult(result: TemplateResult) {
		if (this.template.canPathBy(result)) {
			this.template.patch(result)
		}
		else {
			let context = this.source.getContext()
			let newTemplate = new Template(result, context)
			this.template.replaceWith(newTemplate)
			this.template = newTemplate
		}
	}

	/** Update item and indices. */
	update(item: T, index: number) {
		this.item = item
		this.index = index
		this.watcher.update()
	}

	/** Remove elements and disconnect. Can connect again later. */
	remove() {
		this.disconnect()
		this.template.remove()
	}

	/** Just disconnect. */
	disconnect() {
		this.getWatcherGroup().delete(this.watcher)
	}

	/** Connect after disconnected. */
	connect() {
		this.getWatcherGroup().add(this.watcher)
	}
}