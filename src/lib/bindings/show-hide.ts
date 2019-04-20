import {Binding, defineBinding} from './define'
import {Transition, TransitionOptions} from '../transition'
import {Context} from '../component'


interface ShowHideBindingOptions {
	when: boolean
	transition: TransitionOptions
	enterAtStart?: boolean
	leaveAtStart?: boolean
}

/**
 * `:show="boolean"`
 * `:show="{when: boolean, transition: TransitionOptions}"`
 */
class ShowBinding implements Binding {

	private el: HTMLElement
	private context: Context
	private value: boolean | undefined = undefined
	private enterAtStart: boolean = false
	private leaveAtStart: boolean = false
	private transitionOptions: TransitionOptions | null = null

	constructor(el: Element, value: unknown, _modifiers: any, context: Context) {
		this.el = el as HTMLElement
		this.context = context
		this.update(value as any)
	}

	update(value: boolean | ShowHideBindingOptions) {
		let newValue: boolean

		if (value && typeof value === 'object') {
			newValue = value.when
			this.enterAtStart = !!value.enterAtStart
			this.leaveAtStart = !!value.leaveAtStart
			this.initTransitionOptions(value.transition)
		}
		else {
			newValue = value
			this.enterAtStart = false
			this.leaveAtStart = false
			this.initTransitionOptions(undefined)
		}

		if (newValue !== this.value) {
			// Not play transition for the first time by default
			if (this.transitionOptions && (this.value !== undefined || (newValue && this.enterAtStart || !newValue && this.leaveAtStart))) {
				if (newValue) {
					this.el.hidden = false
					new Transition(this.el, this.transitionOptions).enter()
				}
				else {
					new Transition(this.el, this.transitionOptions).leave().then((finish: boolean) => {
						// If was stopped by a enter transition, we can't hide.
						if (finish) {
							this.el.hidden = true
						}
					})
				}
			}
			else {
				if (newValue) {
					this.el.hidden = false
				}
				else {
					this.el.hidden = true
				}
			}

			this.value = newValue
		}
	}

	private initTransitionOptions(transitionOptions: TransitionOptions | undefined) {
		if (transitionOptions) {
			if (transitionOptions.onend) {
				transitionOptions.onend = transitionOptions.onend.bind(this.context)
			}
			this.transitionOptions = transitionOptions
		}
		else {
			this.transitionOptions = null
		}
	}
}

defineBinding('show', ShowBinding)


/**
 * `:hide="boolean"`
 * `:hide="{when: boolean, transition: TransitionOptions}"`
 */
defineBinding('hide', class HideBinding extends ShowBinding {

	update(value: boolean | ShowHideBindingOptions) {
		if (typeof value === 'object') {
			value.when = !value.when
		}
		else {
			value = !value
		}

		super.update(value)
	}
})
