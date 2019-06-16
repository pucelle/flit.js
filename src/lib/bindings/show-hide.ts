import {Binding, defineBinding, BindingResult} from './define'
import {Transition, ShortTransitionOptions} from '../transition'
import {Context} from '../component'

type TransitionTypedCallback = (type: 'enter' | 'leave', finish: boolean) => void

export interface ShowHideBindingOptions {
	transition: ShortTransitionOptions
	enterAtStart?: boolean
	leaveAtStart?: boolean
	onend?: TransitionTypedCallback
}

/**
 * `:show="boolean"`
 * `:show="{when: boolean, transition: TransitionOptions}"`
 */
class ShowBinding implements Binding<[any, ShowHideBindingOptions | undefined]> {

	private el: HTMLElement
	private context: Context
	private value: boolean | undefined = undefined
	private enterAtStart: boolean = false
	private leaveAtStart: boolean = false
	private transitionOptions: ShortTransitionOptions | null = null
	private onend: TransitionTypedCallback | null = null

	constructor(el: Element, _modifiers: any, context: Context) {
		this.el = el as HTMLElement
		this.context = context
	}

	update(value: any, options?: ShowHideBindingOptions) {
		value = !!value

		if (options) {
			this.enterAtStart = !!options.enterAtStart
			this.leaveAtStart = !!options.leaveAtStart
			this.onend = options.onend || null
			this.initTransitionOptions(options.transition)
		}
		else {
			this.enterAtStart = false
			this.leaveAtStart = false
			this.onend = null
			this.initTransitionOptions(undefined)
		}

		if (value !== this.value) {
			// Not play transition for the first time by default
			if (this.transitionOptions && (this.value !== undefined || (value && this.enterAtStart || !value && this.leaveAtStart))) {
				if (value) {
					this.el.hidden = false
					new Transition(this.el, this.transitionOptions).enter().then((finish: boolean) => {
						if (this.onend) {
							this.onend.call(this.context, 'enter', finish)
						}
					})
				}
				else {
					new Transition(this.el, this.transitionOptions).leave().then((finish: boolean) => {
						// If was stopped by a enter transition, we can't hide.
						if (finish) {
							this.el.hidden = true
						}

						if (this.onend) {
							this.onend.call(this.context, 'leave', finish)
						}
					})
				}
			}
			else {
				if (value) {
					this.el.hidden = false
				}
				else {
					this.el.hidden = true
				}
			}

			this.value = value
		}
	}

	private initTransitionOptions(transitionOptions: ShortTransitionOptions | undefined) {
		if (transitionOptions) {
			this.transitionOptions = transitionOptions
		}
		else {
			this.transitionOptions = null
		}
	}

	remove() {
		this.el.hidden = false
	}
}

export const show = defineBinding('show', ShowBinding) as (value: any, options?: ShowHideBindingOptions) => BindingResult


/**
 * `:hide="boolean"`
 * `:hide="{when: boolean, transition: TransitionOptions}"`
 */
class HideBinding extends ShowBinding {

	update(value: any, options?: ShowHideBindingOptions) {
		super.update(!value, options)
	}
}

export const hide = defineBinding('hide', HideBinding) as (value: any, options?: ShowHideBindingOptions) => BindingResult