import {TransitionOptions, Transition} from './transition'
import {Context} from '../component'
import {Options} from './options'


export interface DirectiveTransitionOptions {
	
	/** Transition options to control enter and leave transition. */
	transition?: TransitionOptions

	/** Should play enter transition for just created element. */
	enterAtStart?: boolean

	/** Should play leave transition for just created element. */
	leaveAtStart?: boolean

	/** Call it when transition end. */
	onend?: (type: 'enter' | 'leave', finish: boolean) => void
}


/** Class to manage transition options, expecially to know should play transition when at start. */
export class DirectiveTransition {
	
	private context: Context
	private options: Options<DirectiveTransitionOptions> = new Options({})
	private firstlyUpdate: boolean | null = null

	constructor(context: Context) {
		this.context = context
	}

	updateOptions(options: DirectiveTransitionOptions | undefined) {
		this.options.update(options)
		this.firstlyUpdate = this.firstlyUpdate === null ? true : false
	}

	shouldPlay(): boolean {
		return !!this.options.get('transition')
	}

	shouldPlayEnter(): boolean {
		if (!this.shouldPlay()) {
			return false
		}

		if (this.firstlyUpdate && !this.options.get('enterAtStart')) {
			return false
		}

		return true
	}

	
	shouldPlayLeave(): boolean {
		if (!this.shouldPlay()) {
			return false
		}

		if (this.firstlyUpdate && !this.options.get('leaveAtStart')) {
			return false
		}

		return true
	}

	async playEnter(el: HTMLElement): Promise<boolean> {
		if (!this.shouldPlay()) {
			return true
		}

		let transition = this.options.get('transition')
		let onend = this.options.get('onend')
		let finish = await new Transition(el, transition).enter()
		if (onend) {
			onend.call(this.context, 'enter', finish)
		}

		return finish
	}

	async playLeave(el: HTMLElement): Promise<boolean> {
		if (!this.shouldPlay()) {
			return true
		}
		
		let transition = this.options.get('transition')
		let onend = this.options.get('onend')
		let finish = await new Transition(el, transition).leave()
		if (onend) {
			onend.call(this.context, 'leave', finish)
		}

		return finish
	}
}


