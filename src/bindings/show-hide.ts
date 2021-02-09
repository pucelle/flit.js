import {defineBinding, BindingResult, Binding} from './define'
import {ContextualTransition, ContextualTransitionOptions} from '../internals/contextual-transition'
import type {Context} from '../component'


/**
 * `:show` binding will update element's visibility state.
 * 
 * `:show=${anyValue}`
 */
export class ShowBinding implements Binding<any> {

	private readonly el: HTMLElement
	private readonly transition: ContextualTransition

	private value: boolean | undefined = undefined

	constructor(el: Element, context: Context) {
		this.el = el as HTMLElement
		this.transition = new ContextualTransition(context)
	}

	update(value: any, options?: ContextualTransitionOptions) {
		value = !!value
		this.transition.updateOptions(options)

		if (value !== this.value) {
			if (value) {
				this.el.hidden = false

				if (this.transition.shouldPlayEnter()) {
					this.transition.playEnter(this.el)
				}	
			}
			else {
				if (this.transition.shouldPlayLeave()) {
					this.transition.playLeave(this.el).then(finish => {
						if (finish) {
							this.el.hidden = true
						}
					})
				}
				else {
					this.el.hidden = true
				}
			}

			this.value = value
		}
	}

	remove() {
		this.el.hidden = false
	}
}

/**
 * `show(...)` binding will update element's visibility state.
 * You may also use `:show` if no need to specify transition.
 * 
 * `show(visible: any, transition: TransitionOptions)`
 * `show(visible: any, options: {transition: TransitionOptions, enterAtStart, leaveAtStart, onend})`
 */
export const show = defineBinding('show', ShowBinding) as (value: any, options?: ContextualTransitionOptions) => BindingResult


/**
 * `:hide` binding will update element's visibility state.
 * 
 * `:hide=${anyValue}`
 */
export class HideBinding extends ShowBinding {

	update(value: any, options?: ContextualTransitionOptions) {
		super.update(!value, options)
	}
}

/**
 * `hide()` binding will update element's visibility state.
 * 
 * `hide(hidden: any, transition: TransitionOptions)`
 * `hide(hidden: any, options: {transition: TransitionOptions, enterAtStart, leaveAtStart, onend})`
 */
export const hide = defineBinding('hide', HideBinding) as (value: any, options?: ContextualTransitionOptions) => BindingResult