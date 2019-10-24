import {Context} from '../component'
import {Template, TemplateResult} from '../template'
import {Watcher, globalWatcherGroup} from '../watcher'


export type TemplateFn<Item> = (item: Item, index: number) => TemplateResult

/** Used to watch and update template result generated from `templateFn`. */
export class WatchedTemplate<Item> {

	private context: Context
	private templateFn: TemplateFn<Item>
	private watcher!: Watcher<TemplateResult>

	item: Item
	index: number
	template!: Template

	constructor(context: Context, templateFn: TemplateFn<Item>, item: Item, index: number) {
		this.context = context
		this.templateFn = templateFn
		this.item = item
		this.index = index
		this.parseAndWatchTemplate()
	}

	private parseAndWatchTemplate() {
		let {templateFn} = this

		let watchFn = () => {
			let result = templateFn(this.item, this.index)
			return result
		}
	
		let onUpdate = (result: TemplateResult) => {
			// Note that the template update in the watcher updating queue.
			if (this.template.canMergeWith(result)) {
				this.template.merge(result)
			}
			else {
				let newTemplate = new Template(result, this.context)
				this.template.range.startNode.before(newTemplate.range.getFragment())
				this.template.remove()
				this.template = newTemplate
			}
		}
	
		let watcher = new Watcher(watchFn, onUpdate)
		this.watcher = watcher
		this.template = new Template(watcher.value, this.context)
		
		if (this.context) {
			this.context.__addWatcher(watcher)
		}
		else {
			globalWatcherGroup.add(watcher)
		}
	}

	updateIndex(index: number) {
		if (index !== this.index) {
			this.index = index
			this.watcher.__updateImmediately()
		}
	}

	update(item: Item, index: number) {
		if (item !== this.item || index !== this.index) {
			this.item = item
			this.index = index
			this.watcher.__updateImmediately()
		}
	}

	remove() {
		this.template!.remove()
		this.watcher.disconnect()
	}
}