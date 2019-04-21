import {TransitionOptions, ShortTransitionOptions, formatShortTransitionOptions} from '../transition'
import {Context} from '../component'


export type DirectiveTransitionOptions = DirectiveTransitionAtStartOptions | ShortTransitionOptions

export type TransitionTypedCallback = (type: 'enter' | 'leave', finish: boolean) => void

export interface DirectiveTransitionAtStartOptions {
	transition: ShortTransitionOptions
	enterAtStart?: boolean
	onend?: TransitionTypedCallback
}


export class DirectiveTransition {
	
	context: Context
	protected transitionOptions: TransitionOptions | null = null
	protected enterAtStart: boolean = false
	protected onend: TransitionTypedCallback | null = null

	constructor(context: Context) {
		this.context = context
	}

	protected initTransitionOptions(options: DirectiveTransitionOptions | undefined) {
		if (options && typeof options === 'object' && options.hasOwnProperty('transition')) {
			let opt = options as DirectiveTransitionAtStartOptions
			this.enterAtStart = !!opt.enterAtStart
			this.onend = opt.onend || null
			this.transitionOptions = formatShortTransitionOptions(opt.transition as ShortTransitionOptions)
		}
		else {
			this.enterAtStart = false
			this.onend = null

			if (options) {
				this.transitionOptions = formatShortTransitionOptions(options as ShortTransitionOptions)
			}
			else {
				this.transitionOptions = null
			}
		}
	}
}