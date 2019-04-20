import {TransitionOptions, ShortTransitionOptions, formatShortTransitionOptions} from '../transition'


export type DirectiveTransitionOptions = DirectiveTransitionAtStartOptions | ShortTransitionOptions

export interface DirectiveTransitionAtStartOptions {
	transition: ShortTransitionOptions
	enterAtStart?: boolean
}


export class DirectiveTransition {

	protected enterAtStart: boolean = false
	protected transitionOptions: TransitionOptions | null = null

	protected initTransitionOptions(options: DirectiveTransitionOptions | undefined) {
		if (options && typeof options === 'object' && options.hasOwnProperty('transition')) {
			let opt = options as DirectiveTransitionAtStartOptions
			this.enterAtStart = !!opt.enterAtStart
			this.transitionOptions = formatShortTransitionOptions(opt.transition as ShortTransitionOptions)
		}
		else {
			this.enterAtStart = false

			if (options) {
				this.transitionOptions = formatShortTransitionOptions(options as ShortTransitionOptions)
			}
			else {
				this.transitionOptions = null
			}
		}
	}
}