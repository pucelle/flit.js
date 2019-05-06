import {TransitionOptions, ShortTransitionOptions, formatShortTransitionOptions, Transition} from '../transition'
import {Context} from '../component'
import {Template, TemplateResult, text} from '../parts';
import {Watcher} from '../watcher';


export type DirectiveTransitionOptions = DirectiveTransitionAtStartOptions | ShortTransitionOptions

export type TransitionTypedCallback = (type: 'enter' | 'leave', finish: boolean) => void

export interface DirectiveTransitionAtStartOptions {
	transition: ShortTransitionOptions
	enterAtStart?: boolean
	onend?: TransitionTypedCallback
}


export class DirectiveTransition {
	
	private context: Context
	private options: TransitionOptions | null = null
	private enterAtStart: boolean = false
	private onend: TransitionTypedCallback | null = null

	constructor(context: Context, options: DirectiveTransitionOptions | undefined) {
		this.context = context
		this.setOptions(options)
	}

	shouldPlayEnterMayAtStart(atStart: boolean): boolean {
		return !!this.options && (atStart && this.enterAtStart || !atStart)
	}

	shouldPlay(): boolean {
		return !!this.options
	}

	setOptions(options: DirectiveTransitionOptions | undefined) {
		if (options && typeof options === 'object' && options.hasOwnProperty('transition')) {
			let opt = options as DirectiveTransitionAtStartOptions
			this.enterAtStart = !!opt.enterAtStart
			this.onend = opt.onend || null
			this.options = formatShortTransitionOptions(opt.transition as ShortTransitionOptions)
		}
		else {
			this.enterAtStart = false
			this.onend = null

			if (options) {
				this.options = formatShortTransitionOptions(options as ShortTransitionOptions)
			}
			else {
				this.options = null
			}
		}
	}

	async playEnterAt(el: HTMLElement): Promise<boolean> {
		let finish = await new Transition(el, this.options!).enter()
		if (this.onend) {
			this.onend.call(this.context, 'enter', finish)
		}
		return finish
	}

	async playLeaveAt(el: HTMLElement): Promise<boolean> {
		let finish = await new Transition(el, this.options!).leave()
		if (this.onend) {
			this.onend.call(this.context, 'leave', finish)
		}
		return finish
	}
}



export type TemplateFn<T> = (item: T, index: number) => TemplateResult | string

/** Used to watch and update template result generated from `templateFn`. */
export class WatchedTemplate<T> {

	private context: Context
	private templateFn: TemplateFn<T>
	private item: T
	private index: number
	private watcher!: Watcher<TemplateResult>
	template!: Template

	constructor(context: Context, templateFn: TemplateFn<T>, item: T, index: number) {
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
			if (typeof result === 'string') {
				result = text`${result}`
			}
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
	
		this.watcher = new Watcher(watchFn, onUpdate)
		this.template = new Template(this.watcher.value, this.context)
	}

	updateIndex(index: number) {
		if (index !== this.index) {
			this.index = index
			this.watcher.__updateImmediately()
		}
	}

	update(item: T, index: number) {
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