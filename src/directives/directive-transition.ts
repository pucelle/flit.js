import {StandardTransitionOptions, TransitionOptions, formatShortTransitionOptions, Transition} from '../transition'
import {Context} from '../component'


export type DirectiveTransitionOptions = DirectiveStandardTransitionOptions | TransitionOptions

type TransitionTypedCallback = (type: 'enter' | 'leave', finish: boolean) => void

export interface DirectiveStandardTransitionOptions {
	transition: TransitionOptions
	enterAtStart?: boolean
	leaveAtStart?: boolean
	onend?: TransitionTypedCallback
}


/** @hidden */
export class DirectiveTransition {
	
	private context: Context
	private options: StandardTransitionOptions | null = null
	private enterAtStart: boolean = false
	private leaveAtStart: boolean = false
	private onend: TransitionTypedCallback | null = null

	constructor(context: Context, options?: DirectiveTransitionOptions) {
		this.context = context
		this.setOptions(options)
	}

	setOptions(options: DirectiveTransitionOptions | undefined) {
		if (options && typeof options === 'object' && options.hasOwnProperty('transition')) {
			let opt = options as DirectiveStandardTransitionOptions
			this.enterAtStart = !!opt.enterAtStart
			this.leaveAtStart = !!opt.leaveAtStart
			this.onend = opt.onend || null
			this.options = formatShortTransitionOptions(opt.transition as TransitionOptions)
		}
		else {
			this.enterAtStart = false
			this.leaveAtStart = false
			this.onend = null

			if (options) {
				this.options = formatShortTransitionOptions(options as TransitionOptions)
			}
			else {
				this.options = null
			}
		}
	}

	shouldPlay(): boolean {
		return !!this.options
	}

	shouldPlayEnter(atStart: boolean = false): boolean {
		if (!this.shouldPlay()) {
			return false
		}

		if (atStart && !this.enterAtStart) {
			return false
		}

		return true
	}

	
	shouldPlayLeave(atStart: boolean = false): boolean {
		if (!this.shouldPlay()) {
			return false
		}

		if (atStart && !this.leaveAtStart) {
			return false
		}

		return true
	}

	async mayPlayEnter(el: HTMLElement): Promise<boolean> {
		if (!this.shouldPlay()) {
			return true
		}

		let finish = await new Transition(el, this.options!).enter()
		if (this.onend) {
			this.onend.call(this.context, 'enter', finish)
		}

		return finish
	}

	async mayPlayLeave(el: HTMLElement): Promise<boolean> {
		if (!this.shouldPlay()) {
			return true
		}
		
		let finish = await new Transition(el, this.options!).leave()
		if (this.onend) {
			this.onend.call(this.context, 'leave', finish)
		}
		return finish
	}
}


