import {Binding, defineBinding} from './define'
import {Transition, TransitionOptions} from '../transition'


interface ShowHideBindingOptions extends TransitionOptions {
	when: boolean
	runAtStart?: boolean
	transition?: TransitionOptions
}

/**
 * `:show="boolean"`
 * `:show="{when: boolean, transition: TransitionOptions}"`
 */
class ShowBinding implements Binding {

	private el: HTMLElement
	private value: boolean | undefined = undefined
	private runAtStart: boolean = false
	private transitionOptions: TransitionOptions | null = null

	constructor(el: Element, value: unknown) {
		this.el = el as HTMLElement
		this.update(value as any)
	}

	update(value: boolean | ShowHideBindingOptions) {
		let newValue: boolean

		if (value && typeof value === 'object') {
			newValue = value.when
			this.runAtStart = !!value.runAtStart
			this.initTransitionOptions(value.transition)
		}
		else {
			newValue = value
			this.initTransitionOptions(undefined)
		}

		if (newValue !== this.value) {
			// Not play transition for the first time by default
			if (this.value === undefined && !this.runAtStart || !this.transitionOptions) {
				if (newValue) {
					this.el.hidden = false
				}
				else {
					this.el.hidden = true
				}
			}
			else {

				if (newValue) {
					this.el.hidden = false
					new Transition(this.el, this.transitionOptions).enter()
				}
				else {
					new Transition(this.el, this.transitionOptions).leave().then((finish: boolean) => {
						// If was stopped by a enter transition, we can't hide it.
						if (finish) {
							this.el.hidden = true
						}
					})
				}
			}

			this.value = newValue
		}
	}

	private initTransitionOptions(transitionOptions: TransitionOptions | undefined) {
		if (transitionOptions) {
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
