import {TransitionOptions, ShortTransitionOptions, formatShortTransitionOptions} from '../transition'
import {Context} from '../component';


export type DirectiveTransitionOptions = DirectiveTransitionAtStartOptions | ShortTransitionOptions

export interface DirectiveTransitionAtStartOptions {
	transition: ShortTransitionOptions
	enterAtStart?: boolean
}


export class DirectiveTransition {
	
	context: Context
	protected enterAtStart: boolean = false
	protected transitionOptions: TransitionOptions | null = null

	constructor(context: Context) {
		this.context = context
	}

	protected initTransitionOptions(options: DirectiveTransitionOptions | undefined) {
		let transitionOptions: TransitionOptions | null = null

		if (options && typeof options === 'object' && options.hasOwnProperty('transition')) {
			let opt = options as DirectiveTransitionAtStartOptions
			this.enterAtStart = !!opt.enterAtStart
			transitionOptions = formatShortTransitionOptions(opt.transition as ShortTransitionOptions)
		}
		else {
			this.enterAtStart = false

			if (options) {
				transitionOptions = formatShortTransitionOptions(options as ShortTransitionOptions)
			}
			else {
				transitionOptions = null
			}
		}

		if (transitionOptions) {
			if (transitionOptions.onend) {
				transitionOptions.onend = transitionOptions.onend.bind(this.context)
			}
		}

		this.transitionOptions = transitionOptions
	}
}