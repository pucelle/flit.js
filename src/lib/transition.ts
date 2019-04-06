import {once, off} from './dom-event'


export type AnimationEasing = keyof typeof CUBIC_BEZIER_EASINGS | 'linear'
export type TransitionCallback = (finish: boolean) => void
export type TransitionTypedCallback = (type: 'enter' | 'leave', finish: boolean) => void

export interface TransitionOptions {
	name: string
	duration?: number
	easing?: AnimationEasing
	direction?: 'enter' | 'leave' | 'both'
	callback?: TransitionTypedCallback
}

interface JSTransitionOptions {
	duration: number
	easing: AnimationEasing
}

interface JSTransitionConstructor {
	new (el: HTMLElement, options: JSTransitionOptions): JSTransition
}

interface JSTransition {
	enter?: (callback: TransitionCallback) => void
	leave?: (callback: TransitionCallback) => void
	clean: () => void
}


const DEFAULT_TRANSITION_OPTIONS = {
	duration: 200,
	easing: 'ease-out',
	direction: 'both'
}

// Copied from `Bourbon` source codes.
const CUBIC_BEZIER_EASINGS = {

	// BASE
	'ease'              : [0.250,  0.100, 0.250, 1.000],
	'ease-in'           : [0.420,  0.000, 1.000, 1.000],
	'ease-out'          : [0.000,  0.000, 0.580, 1.000],
	'ease-in-out'       : [0.420,  0.000, 0.580, 1.000],

	// EASE IN
	'ease-in-quad'      : [0.550,  0.085, 0.680, 0.530],
	'ease-in-cubic'     : [0.550,  0.055, 0.675, 0.190],
	'ease-in-quart'     : [0.895,  0.030, 0.685, 0.220],
	'ease-in-quint'     : [0.755,  0.050, 0.855, 0.060],
	'ease-in-sine'      : [0.470,  0.000, 0.745, 0.715],
	'ease-in-expo'      : [0.950,  0.050, 0.795, 0.035],
	'ease-in-circ'      : [0.600,  0.040, 0.980, 0.335],
	'ease-in-back'      : [0.600, -0.280, 0.735, 0.045],

	// EASE OUT
	'ease-out-quad'     : [0.250,  0.460, 0.450, 0.940],
	'ease-out-cubic'    : [0.215,  0.610, 0.355, 1.000],
	'ease-out-quart'    : [0.165,  0.840, 0.440, 1.000],
	'ease-out-quint'    : [0.230,  1.000, 0.320, 1.000],
	'ease-out-sine'     : [0.390,  0.575, 0.565, 1.000],
	'ease-out-expo'     : [0.190,  1.000, 0.220, 1.000],
	'ease-out-circ'     : [0.075,  0.820, 0.165, 1.000],
	'ease-out-back'     : [0.175,  0.885, 0.320, 1.275],

	// EASE IN OUT
	'ease-in-out-quad'  : [0.455,  0.030, 0.515, 0.955],
	'ease-in-out-cubic' : [0.645,  0.045, 0.355, 1.000],
	'ease-in-out-quart' : [0.770,  0.000, 0.175, 1.000],
	'ease-in-out-quint' : [0.860,  0.000, 0.070, 1.000],
	'ease-in-out-sine'  : [0.445,  0.050, 0.550, 0.950],
	'ease-in-out-expo'  : [1.000,  0.000, 0.000, 1.000],
	'ease-in-out-circ'  : [0.785,  0.135, 0.150, 0.860],
	'ease-in-out-back'  : [0.680, -0.550, 0.265, 1.550],
}

function getAnimationEasing(easing: AnimationEasing): string {
	return CUBIC_BEZIER_EASINGS.hasOwnProperty(easing)
		? 'cubic-bezier(' + CUBIC_BEZIER_EASINGS[easing as keyof typeof CUBIC_BEZIER_EASINGS].join(', ') + ')'
		: ''
}

const elementTransitionMap: WeakMap<HTMLElement, Transition> = new WeakMap()
const definedTransition: Map<string, JSTransitionConstructor> = new Map()

/** Register a js transiton. */
export function defineTransion(name: string, TransitionConstructor: JSTransitionConstructor) {
	definedTransition.set(name, TransitionConstructor)
}


export class Transition {

	private el: HTMLElement
	private options: TransitionOptions
	private cleaner: (() => void) | null = null

	constructor(el: HTMLElement, options: TransitionOptions) {
		this.el = el
		this.options = options

		if (elementTransitionMap.has(this.el)) {
			elementTransitionMap.get(this.el)!.clean()
		}
		
		elementTransitionMap.set(this.el, this)
	}

	enter(callback?: TransitionCallback) {
		this.clean()

		let willPlay = this.options.direction !== 'leave'
		if (!willPlay) {
			if (callback) {
				callback(true)
			}
			return
		}

		let onEntered = (finish: boolean) => {
			if (this.options.callback) {
				this.options.callback('enter', finish)
			}

			if (callback) {
				callback(finish)
			}

			elementTransitionMap.delete(this.el)
		}

		if (definedTransition.has(name)) {
			this.jsEnter(onEntered)
		}
		else {
			this.classEnterOrLeave('enter', onEntered)
		}
	}

	leave(callback?: TransitionCallback) {
		this.clean()

		let willPlay = this.options.direction !== 'enter'
		if (!willPlay) {
			if (callback) {
				callback(true)
			}
			return
		}

		let onLeaved = (finish: boolean) => {
			this.el.style.pointerEvents = ''

			if (this.options.callback) {
				this.options.callback('leave', finish)
			}

			if (callback) {
				callback(finish)
			}

			elementTransitionMap.delete(this.el)
		}

		this.el.style.pointerEvents = 'none'

		if (definedTransition.has(name)) {
			this.jsLeave(onLeaved)
		}
		else {
			this.classEnterOrLeave('leave', onLeaved)
		}
	}

	private jsEnter(onEntered: TransitionCallback) {
		let jsTransition = this.getJSTransitionInstance()

		if (jsTransition.enter) {
			jsTransition.enter(onEntered)
			this.cleaner = jsTransition.clean.bind(jsTransition)
		}
		else {
			onEntered(true)
		}
	}

	private jsLeave(onLeaved: TransitionCallback) {
		let jsTransition = this.getJSTransitionInstance()

		if (jsTransition.leave) {
			jsTransition.leave(onLeaved)
			this.cleaner = jsTransition.clean.bind(jsTransition)
		}
		else {
			onLeaved(true)
		}
	}

	private getJSTransitionInstance() {
		let JsTransition = definedTransition.get(this.options.name)!
		
		return new JsTransition(this.el, {
			duration: this.options.duration || DEFAULT_TRANSITION_OPTIONS.duration,
			easing: this.options.easing || (DEFAULT_TRANSITION_OPTIONS.easing as 'ease-out')
		})
	}

	private classEnterOrLeave(type: string, callback: TransitionCallback) {
		let className = this.options.name + '-' + type
		let duration = this.options.duration
		let easing = this.options.easing
		let canceled = false

		if (duration) {
			this.el.style.transitionDuration = String(duration / 1000) + 's'
		}

		if (easing && easing!== 'linear') {
			this.el.style.transitionTimingFunction = getAnimationEasing(easing)
		}

		this.el.style.transition = 'none'
		this.el.classList.add(className, className + '-from')

		requestAnimationFrame(() => {
			if (canceled) {
				return
			}

			if (duration) {
				this.el.style.transitionDuration = ''
			}

			if (easing && easing!== 'linear') {
				this.el.style.transitionTimingFunction = ''
			}

			this.el.style.transition = ''
			this.el.classList.remove(className + '-from')
			this.el.classList.add(className + '-to')

			this.onceTransitionEnd((finish: boolean) => {
				this.el.classList.remove(className, className + '-to')
				callback(finish)
			})
		})

		this.cleaner = () => {
			canceled = true
		}
	}

	private onceTransitionEnd(onEnd: TransitionCallback) {
		let computedStyle = getComputedStyle(this.el)
		let transitionDuration = parseFloat(computedStyle.transitionDuration) || 0
		let animationDuration = parseFloat(computedStyle.animationDuration) || 0
		let eventName = transitionDuration > 0 ? 'transitionend' : 'animationend'
		let duration = (transitionDuration || animationDuration) * 1000

		let onTransitionEnd = () => {
			clearTimeout(timeoutId)
			this.el.style.pointerEvents = ''
			onEnd(true)
		}

		let onTimeout = () => {
			off(this.el, eventName, onTransitionEnd)
			this.el.style.pointerEvents = ''
			onEnd(true)
		}

		let timeoutId = setTimeout(onTimeout, duration + 50)
		once(this.el, eventName, onTransitionEnd)

		this.cleaner = () => {
			clearTimeout(timeoutId)
			off(this.el, eventName, onTransitionEnd)
			onEnd(false)
		}
	}

	private clean() {
		if (this.cleaner) {
			this.cleaner()
			this.cleaner = null
		}
	}
}
