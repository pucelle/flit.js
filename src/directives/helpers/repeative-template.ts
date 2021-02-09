import {Context} from '../../component'
import {Template, TemplateResult} from '../../template'
import {GlobalWatcherGroup, LazyWatcher} from '../../global/watcher'


export type TemplateFn<T> = (item: T, index: number) => TemplateResult


/** 
 * A `repeat` directive can only watches top level data changes,
 * can't watch property changes of each `item`.
 * So this class is used to watch and update template result that generated from `templateFn` from an `item`.
 */
export class RepeativeTemplate<T> {

	private readonly context: Context
	private readonly templateFn: TemplateFn<T>
	private readonly watcher: LazyWatcher<TemplateResult>

	item: T
	index: number
	template: Template

	constructor(context: Context, templateFn: TemplateFn<T>, item: T, index: number) {
		this.context = context
		this.templateFn = templateFn

		this.item = item
		this.index = index
		
		/** Update after components and top level watchers update completed. */
		this.watcher = new LazyWatcher(this.getTemplateResult.bind(this), this.onUpdateTemplateResult.bind(this))
		this.template = new Template(this.watcher.value, this.context)
		this.getWatcherGroup().add(this.watcher)
	}

	/** Get watcher group to add or delete watcher. */
	protected getWatcherGroup() {
		return this.context?.__getWatcherGroup() || GlobalWatcherGroup
	}

	/** To get current template result for watching. */
	private getTemplateResult() {
		return this.templateFn(this.item, this.index)
	}

	/** After template result changed. */
	private onUpdateTemplateResult(result: TemplateResult) {
		if (this.template.canMergeWith(result)) {
			this.template.merge(result)
		}
		else {
			let newTemplate = new Template(result, this.context)
			this.template.replaceWith(newTemplate)
			this.template = newTemplate
		}
	}

	update(item: T, index: number) {
		if (item !== this.item || index !== this.index) {
			this.item = item
			this.index = index
			this.watcher.update()
		}
	}

	updateIndex(index: number) {
		if (index !== this.index) {
			this.index = index
			this.watcher.update()
		}
	}

	/** Remove elements and disconnect. Can connect again. */
	disconnect() {
		this.template.remove()
		this.getWatcherGroup().delete(this.watcher)
	}

	/** Connect after disconnected. */
	connect() {
		this.getWatcherGroup().add(this.watcher)
		this.watcher.update()
	}
}