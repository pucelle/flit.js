import type {Context} from '../component'
import {TransitionOptions, Transition} from './transition'
import {UpdatableOptions} from './updatable-options'


export interface ContextualTransitionOptions extends TransitionOptions {

	/** Doesn't play enter transition except this option is `true` for just created element. */
	enterAtStart?: boolean

	/** Doesn't play leave transition except this option is `true` for just created element. */
	leaveAtStart?: boolean

	/**
	 * Call it after transition end.
	 * Useful when you want to hide element after transition end.
	 */
	onend?: (type: 'enter' | 'leave', finish: boolean) => void
}


/** Class to manage transition options, expecially to know should play transition when at start. */
export class ContextualTransition {
	
	private readonly context: Context
	private readonly options: UpdatableOptions<ContextualTransitionOptions> = new UpdatableOptions({})

	/** Be `true` only after firstly updated. */
	private firstTimeUpdated: boolean | null = null

	constructor(context: Context) {
		this.context = context
	}

	/** Sometimes you may just leaves `name` and `properties` to be `undefined` if you want to control playing dynamically. */
	canPlay() {
		return this.options.has('name') || this.options.has('properties')
	}

	/** Update options data. */
	updateOptions(options: ContextualTransitionOptions | undefined) {
		this.options.update(options)
		this.firstTimeUpdated = this.firstTimeUpdated === null ? true : false
	}

	/** Whether should play enter transition. */
	shouldPlayEnter(): boolean {
		if (!this.canPlay() || this.firstTimeUpdated && !this.options.get('enterAtStart')) {
			return false
		}

		return true
	}

	/** Whether should play leave transition. */
	shouldPlayLeave(): boolean {
		if (!this.canPlay() || this.firstTimeUpdated && !this.options.get('leaveAtStart')) {
			return false
		}

		return true
	}

	/** Plays enter transition, must validate `shouldPlayEnter` before. */
	async playEnter(el: HTMLElement): Promise<boolean> {
		let onend = this.options.get('onend')
		let finish = await new Transition(el, this.options.getOptions()).enter()

		if (onend) {
			onend.call(this.context, 'enter', finish)
		}

		return finish
	}

	/** Plays leave transition, must validate `shouldPlayLeave` before. */
	async playLeave(el: HTMLElement): Promise<boolean> {
		let onend = this.options.get('onend')
		let finish = await new Transition(el, this.options.getOptions()).leave()

		if (onend) {
			onend.call(this.context, 'leave', finish)
		}

		return finish
	}
}


