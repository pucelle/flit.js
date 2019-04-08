import {Binding, defineBinding} from './define'
import {Transition, TransitionOptions, ShortTransitionOptions, formatShortTransitionOptions} from '../transition'


/**
 * `:show="boolean"`
 * `:show="{when: boolean, transition: TransitionOptions}"`
 */
defineBinding('show', class ShowBinding implements Binding {

	private el: HTMLElement
	private value: boolean | undefined = undefined
	private transitionOptions: TransitionOptions | null = null

	constructor(el: HTMLElement, value: unknown) {
		this.el = el
		this.update(value as any)
	}

	update(value: boolean | {when: boolean, transition: ShortTransitionOptions}) {
		let newValue: boolean

		if (value && typeof value === 'object') {
			newValue = value.when
			this.initTransitionOptions(value.transition)
		}
		else {
			newValue = value
		}

		if (newValue !== this.value) {
			if (this.value !== undefined && this.transitionOptions) {
				if (newValue) {
					this.el.hidden = false
					this.el.removeAttribute('hidden')
					new Transition(this.el, this.transitionOptions).enter()
				}
				else {
					new Transition(this.el, this.transitionOptions).leave(() => {
						this.el.hidden = true
						this.el.setAttribute('hidden', '')
					})
				}
			}
			else {
				if (newValue) {
					this.el.hidden = false
					this.el.removeAttribute('hidden')
				}
				else {
					this.el.hidden = true
					this.el.setAttribute('hidden', '')
				}
			}
		}
	}

	private initTransitionOptions(transitionOptions: ShortTransitionOptions | undefined) {
		if (transitionOptions) {
			this.transitionOptions = formatShortTransitionOptions(transitionOptions)
		}
		else {
			this.transitionOptions = null
		}
	}
})
