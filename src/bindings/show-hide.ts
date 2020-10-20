import {Binding, defineBinding, BindingResult} from './define'
import {Context} from '../component'
import {DirectiveTransition, DirectiveTransitionOptions} from '../core/directive-transition'


/**
 * `:show="boolean"`
 * `show(visible: boolean, transition: TransitionOptions)`
 * `show(visible: boolean, options: {transition: TransitionOptions, enterAtStart, leaveAtStart, onend})`
 */
class ShowBinding implements Binding<[any, DirectiveTransitionOptions | undefined]> {

	private el: HTMLElement
	private value: boolean | undefined = undefined
	private transition: DirectiveTransition

	constructor(el: Element, context: Context) {
		this.el = el as HTMLElement
		this.transition = new DirectiveTransition(context)
	}

	update(value: any, options?: DirectiveTransitionOptions) {
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

export const show = defineBinding('show', ShowBinding) as (value: any, options?: DirectiveTransitionOptions) => BindingResult


/**
 * `:hide="boolean"`
 * `hide(hidden: boolean, transition: TransitionOptions)`
 * `hide(hidden: boolean, options: {transition: TransitionOptions, enterAtStart, leaveAtStart, onend})`
 */
class HideBinding extends ShowBinding {

	update(value: any, options?: DirectiveTransitionOptions) {
		super.update(!value, options)
	}
}

export const hide = defineBinding('hide', HideBinding) as (value: any, options?: DirectiveTransitionOptions) => BindingResult