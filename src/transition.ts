import {once, off} from './libs/dom-event'
import {onRenderComplete} from './queue'


export type TransitionEasing = keyof typeof CUBIC_BEZIER_EASINGS | 'linear'
export type TransitionProperty = keyof typeof CSS_PROPERTIES
export type TransitionFrame = {[key in TransitionProperty]?: string}
export type TransitionPromise = Promise<boolean>
export type TransitionCallback = (finish: boolean) => void
export type TransitionOptions = string | TransitionProperty[] | StandardTransitionOptions

export interface StandardTransitionOptions {
	name?: string
	properties?: TransitionProperty[],
	duration?: number
	easing?: TransitionEasing
	direction?: 'enter' | 'leave' | 'both'
}

export interface JSTransitionOptions {
	duration: number
	easing: TransitionEasing
}

export interface JSTransitionConstructor {
	new (el: Element, options: JSTransitionOptions): JSTransition
}

export interface JSTransition {
	enter?: TransitionPromise
	leave?: TransitionPromise
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

/**
 * Get `cubic-bezier(...)` from easing name.
 * @param easing The extended easing name.
 */
/** @hidden */
export function getEasing(easing: TransitionEasing): string {
	return CUBIC_BEZIER_EASINGS.hasOwnProperty(easing)
		? 'cubic-bezier(' + CUBIC_BEZIER_EASINGS[easing as keyof typeof CUBIC_BEZIER_EASINGS].join(', ') + ')'
		: 'linear'
}


const elementTransitionMap: WeakMap<Element, Transition> = new WeakMap()
const definedTransition: Map<string, JSTransitionConstructor> = new Map()

/** Register a js transiton. */
export function defineTransion(name: string, TransitionConstructor: JSTransitionConstructor) {
	if (definedTransition.has(name)) {
		console.warn(`You are trying to overwrite transition definition "${name}"`)
	}

	if (CSS_PROPERTIES.hasOwnProperty(name)) {
		console.warn(`"${name}" is an available CSS property, you may confuse them when using short transition`)
	}

	definedTransition.set(name, TransitionConstructor)
}

const CSS_PROPERTIES = {
	width: true,
	height: true,
	opacity: true,
	margin: true,
	marginLeft: true,
	marginRght: true,
	marginTop: true,
	marginBottom: true,
	padding: true,
	paddingLeft: true,
	paddingRght: true,
	paddingTop: true,
	paddingBottom: true,
	borderWidth: true,
	borderLeftWidth: true,
	borderRightWidth: true,
	borderTopWidth: true,
	borderBottomWidth: true,
	transform: true
}

/** @hidden */
export function formatShortTransitionOptions(options: TransitionOptions): StandardTransitionOptions {
	if (Array.isArray(options)) {
		return {
			properties: options
		}
	}
	else if (typeof options === 'string') {
		if (CSS_PROPERTIES.hasOwnProperty(options)) {
			return {
				properties: [options as TransitionProperty]
			}
		}
		else {
			return {
				name: options
			}
		}
	}
	else {
		return options
	}
}


/**
 * Class used to play specified transition on an element.
 * Transition types includes class name, css properties, and registered js transition.
 */
export class Transition {

	private el: Element
	private options: StandardTransitionOptions
	private cleaner: (() => void) | null = null

	constructor(el: Element, options: TransitionOptions) {
		this.el = el
		this.options = formatShortTransitionOptions(options)
		clearTransition(this.el)
		elementTransitionMap.set(this.el, this)
	}

	enter(): TransitionPromise {
		return new Promise(resolve => {
			this.clean()
			
			let direction = this.options.direction
			let willPlay = direction === 'enter' || direction === 'both' || direction === undefined
			if (!willPlay) {
				resolve(true)
				return
			}

			let onEntered = (finish: boolean) => {
				elementTransitionMap.delete(this.el)
				resolve(finish)
			}

			if (this.options.properties) {
				this.cssEnter(onEntered)
			}
			else if (definedTransition.has(name)) {
				this.jsEnter(onEntered)
			}
			else {
				this.classEnterOrLeave('enter', onEntered)
			}
		})
	}

	leave(): TransitionPromise {
		return new Promise(resolve => {
			this.clean()

			let direction = this.options.direction
			let willPlay = direction === 'leave' || direction === 'both' || direction === undefined
			if (!willPlay) {
				resolve(true)
				return
			}

			let el = this.el as HTMLElement | SVGElement

			let onLeaved = (finish: boolean) => {
				el.style.pointerEvents = ''
				elementTransitionMap.delete(this.el)
				resolve(finish)
			}

			el.style.pointerEvents = 'none'

			if (this.options.properties) {
				this.cssLeave(onLeaved)
			}
			else if (definedTransition.has(name)) {
				this.jsLeave(onLeaved)
			}
			else {
				this.classEnterOrLeave('leave', onLeaved)
			}
		})
	}

	private cssEnter(onEntered: TransitionCallback) {
		let startFrame: TransitionFrame = {}
		for (let property of this.options.properties!) {
			startFrame[property] = property === 'transform' ? 'none' : '0'
		}

		let {promise, cancel} = animateFrom(this.el, startFrame,
			this.options.duration || DEFAULT_TRANSITION_OPTIONS.duration,
			this.options.easing || DEFAULT_TRANSITION_OPTIONS.easing as TransitionEasing
		)
		promise.then(onEntered)
		this.cleaner = cancel
	}

	private cssLeave(onLeaved: TransitionCallback) {
		let endFrame: TransitionFrame = {}
		for (let property of this.options.properties!) {
			endFrame[property] = property === 'transform' ? 'none' : '0'
		}

		let {promise, cancel} = animateTo(this.el, endFrame,
			this.options.duration || DEFAULT_TRANSITION_OPTIONS.duration,
			this.options.easing || DEFAULT_TRANSITION_OPTIONS.easing as TransitionEasing
		)
		promise.then(onLeaved)
		this.cleaner = cancel
	}

	private jsEnter(onEntered: TransitionCallback) {
		let jsTransition = this.getJSTransitionInstance()

		if (jsTransition.enter) {
			jsTransition.enter.then(onEntered)
			this.cleaner = jsTransition.clean.bind(jsTransition)
		}
		else {
			onEntered(true)
		}
	}

	private jsLeave(onLeaved: TransitionCallback) {
		let jsTransition = this.getJSTransitionInstance()

		if (jsTransition.leave) {
			jsTransition.leave.then(onLeaved)
			this.cleaner = jsTransition.clean.bind(jsTransition)
		}
		else {
			onLeaved(true)
		}
	}

	private getJSTransitionInstance() {
		let JsTransition = definedTransition.get(this.options.name!)!
		
		return new JsTransition(this.el, {
			duration: this.options.duration || DEFAULT_TRANSITION_OPTIONS.duration,
			easing: this.options.easing || (DEFAULT_TRANSITION_OPTIONS.easing as TransitionEasing)
		})
	}

	private async classEnterOrLeave(type: string, callback: TransitionCallback) {
		let className = this.options.name + '-' + type
		let duration = this.options.duration
		let easing = this.options.easing
		let canceled = false
		let el = this.el as HTMLElement | SVGElement

		if (duration) {
			el.style.transitionDuration = String(duration / 1000) + 's'
		}

		if (easing) {
			el.style.transitionTimingFunction = getEasing(easing)
		}

		el.style.transition = 'none'
		el.classList.add(className, className + '-from')
		
		this.cleaner = () => {
			canceled = true
		}

		// Here to makesure rendering complete for current frame,
		// Then the next `requestAnimationFrame` will be called for a new frame.
		onRenderComplete(() => {
			requestAnimationFrame(() => {
				if (canceled) {
					el.classList.remove(className, className + '-from')
					return
				}

				if (duration) {
					el.style.transitionDuration = ''
				}

				if (easing) {
					el.style.transitionTimingFunction = ''
				}

				el.style.transition = ''
				el.classList.remove(className + '-from')
				el.classList.add(className + '-to')

				this.onceTransitionEnd((finish: boolean) => {
					el.classList.remove(className, className + '-to')
					callback(finish)
				})
			})
		})
	}

	private onceTransitionEnd(onEnd: TransitionCallback) {
		let el = this.el as HTMLElement | SVGElement
		let computedStyle = getComputedStyle(el)
		let transitionDuration = parseFloat(computedStyle.transitionDuration) || 0
		let animationDuration = parseFloat(computedStyle.animationDuration) || 0
		let eventName = transitionDuration > 0 ? 'transitionend' : 'animationend'
		let duration = (transitionDuration || animationDuration) * 1000

		let onTransitionEnd = () => {
			clearTimeout(timeoutId)
			el.style.pointerEvents = ''
			onEnd(true)
		}

		let onTimeout = () => {
			off(el, eventName, onTransitionEnd)
			el.style.pointerEvents = ''
			onEnd(true)
		}

		let timeoutId = setTimeout(onTimeout, duration + 50)
		once(el, eventName, onTransitionEnd)

		this.cleaner = () => {
			clearTimeout(timeoutId)
			off(el, eventName, onTransitionEnd)
			onEnd(false)
		}
	}

	clean() {
		if (this.cleaner) {
			this.cleaner()
			this.cleaner = null
		}
	}
}


/** Clear the transition that is running in the element. */
export function clearTransition(el: Element) {
	if (elementTransitionMap.has(el)) {
		elementTransitionMap.get(el)!.clean()
	}
}


function animate(el: Element, startFrame: TransitionFrame, endFrame: TransitionFrame, duration: number, easing: TransitionEasing) {
	if (!el.animate) {
		return {
			promise: Promise.resolve(false),
			cancel: () => {}
		}
	}

	let cubicEasing = getEasing(easing)

	let animation = el.animate([startFrame, endFrame], {
		easing: cubicEasing,
		duration,
	})

	let promise = new Promise((resolve) => {
		animation.addEventListener('finish', () => {
			resolve(true)
		}, false)

		animation.addEventListener('cancel', () => {
			resolve(false)
		}, false)
	}) as Promise<boolean>

	function cancel() {
		animation.cancel()
	}

	return {
		promise,
		cancel
	}
}

/** The default style of element, which is not 0 */
const DEFAULT_STYLE: {[key: string]: string} = {
	transform: 'none'
}

function animateFrom(el: Element, startFrame: TransitionFrame, duration: number, easing: TransitionEasing) {
	let endFrame: TransitionFrame = {}
	let style = getComputedStyle(el)

	for (let property in startFrame) {
		endFrame[property as TransitionProperty] = (style as any)[property] || DEFAULT_STYLE[property] || '0'
	}

	return animate(el, startFrame, endFrame, duration, easing)
}

function animateTo(el: Element, endFrame: TransitionFrame, duration: number, easing: TransitionEasing) {
	let startFrame: TransitionFrame = {}
	let style = getComputedStyle(el)

	for (let property in endFrame) {
		startFrame[property as TransitionProperty] = (style as any)[property] || DEFAULT_STYLE[property] || '0'
	}

	return animate(el, startFrame, endFrame, duration, easing)
	
	// el will hide, no need to set style to end frame.
}