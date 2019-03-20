

// /*transition Directive*/
// const transitionSymbol = Symbol('transition')

// FF.registerDirective('transition', {

// 	isLiteral: true,


// 	update (options) {
// 		let {el, vm} = this
// 		let transition = el[transitionSymbol]

// 		if (transition) {
// 			transition.updateOptions(options)
// 		}
// 		else {
// 			el[transitionSymbol] = new Transition(vm, el, options)
// 		}
// 	},


// 	unbind () {
// 		let {el} = this

// 		if (el[transitionSymbol]) {
// 			el[transitionSymbol].clear()
// 			delete el[transitionSymbol]
// 		}
// 	}
// })



// function Transition(vm, el, options) {
// 	this.vm = vm
// 	this.el = el
// 	this.initOptions(options)
// 	this._transitionCleaner = null
// }

// Transition.prototype = {

// 	CSS_PROPERTIES: ff.index([
// 		'width',
// 		'height',
// 		'opacity',
// 		'margin',
// 		'margin-left',
// 		'margin-rght',
// 		'margin-top',
// 		'margin-bottom',
// 		'padding',
// 		'padding-left',
// 		'padding-rght',
// 		'padding-top',
// 		'padding-bottom',
// 		'border-width',
// 		'border-left-width',
// 		'border-right-width',
// 		'border-top-width',
// 		'border-bottom-width'
// 	]),

// 	TRANSITION_REGEXP: /^\s*((?:\s*,\s*[\w-]+|[\w-]+)+?)(?:\s+(\d+(?:\.\d+)?)s)?(?:\s+([a-z-]+))?(?:\s+(all|enter|leave))?\s*$/,


// 	initOptions (options) {
// 		if (!options) {
// 			options = {name: ''}
// 		}
// 		else if (typeof options === 'string') {
// 			options = this.parseTransitionString(options)
// 		}

// 		this.name = options.name
// 		this.options = options
// 	},


// 	parseTransitionString (value) {
// 		let m = value.match(this.TRANSITION_REGEXP)

// 		if (!m) {
// 			throw new Error(`"${value}" is not a valid transition`)
// 		}

// 		let name
// 		let [, propertyString, durationString, easing, direction] = m
// 		let properties = propertyString.split(/\s*,\s*/)
// 		let isCSSProperty = !!this.CSS_PROPERTIES[properties[0]]

// 		if (!isCSSProperty && properties.length > 1) {
// 			throw new Error(`only one transition property is allowed when not using css transition`)
// 		}

// 		if (isCSSProperty && properties.length > 1) {
// 			for (let property of properties) {
// 				if (!this.CSS_PROPERTIES[property]) {
// 					throw new Error(`"${property}" is not a valid transition property`)
// 				}
// 			}
// 		}

// 		name = isCSSProperty ? 'css' : properties[0]

// 		let options = {name}

// 		if (isCSSProperty) {
// 			options.properties = properties
// 		}

// 		if (durationString) {
// 			options.duration = Number(durationString) * 1000
// 		}

// 		if (easing) {
// 			options.easing = easing
// 		}

// 		if (direction) {
// 			options.direction = direction
// 		}

// 		return options
// 	},


// 	updateOptions (options) {
// 		this.clear()
// 		this.initOptions(options)
// 	},


// 	//makesure transition proeprties have been fully updated
// 	enterAfterUpdated (fn) {
// 		queues.pushInnerTask(() => {
// 			this.enter(fn)
// 		})
// 	},


// 	leaveAfterUpdated (fn) {
// 		queues.pushInnerTask(() => {
// 			this.leave(fn)
// 		})
// 	},


// 	enter (fn) {
// 		let {vm, el, name, options: {direction}} = this
// 		let willPlay = direction === 'all' || direction === 'enter' || !direction

// 		this.clearLastCSSTransitionEndHandler()

// 		if (!willPlay) {
// 			if (fn) {
// 				fn(true)
// 			}
// 			return
// 		}

// 		let onEntered = (finish) => {
// 			if (fn) {
// 				fn(finish)
// 			}

// 			el.emit('entered')
// 		}

// 		if (!name) {
// 			onEntered(true)
// 			return
// 		}

// 		if (name === 'css') {
// 			this.cssEnter(onEntered)
// 		}
// 		else if (vm.transitions[name]) {
// 			this.jsEnter(onEntered)
// 		}
// 		else {
// 			this.classEnter(onEntered)
// 		}
// 	},


// 	leave (fn) {
// 		let {vm, el, name, options: {direction}} = this
// 		let willPlay = direction === 'all' || direction === 'leave' || !direction

// 		this.clearLastCSSTransitionEndHandler()

// 		if (!willPlay) {
// 			if (fn) {
// 				fn(true)
// 			}
// 			return
// 		}

// 		let onLeaved = (finish) => {
// 			dom.setCSS(el, 'pointer-events', '')

// 			if (fn) {
// 				fn(finish)
// 			}

// 			el.emit('leaved')
// 		}

// 		if (!name) {
// 			onLeaved(true)
// 			return
// 		}

// 		dom.setCSS(el, 'pointer-events', 'none')

// 		if (name === 'css') {
// 			this.cssLeave(onLeaved)
// 		}
// 		else if (vm.transitions[name]) {
// 			this.jsLeave(onLeaved)
// 		}
// 		else {
// 			this.classLeave(onLeaved)
// 		}
// 	},


// 	cssEnter (onEntered) {
// 		let {el} = this
// 		let {properties, duration, easing} = this.options
// 		let startFrame = {}

// 		for (let property of properties) {
// 			startFrame[property] = 0
// 		}

// 		dom.animateFrom(el, startFrame,
// 			duration,
// 			easing
// 		)
// 		.then(onEntered)
// 	},


// 	cssLeave (onLeaved) {
// 		let {el} = this
// 		let {properties, duration, easing} = this.options
// 		let endFrame = {}

// 		for (let property of properties) {
// 			endFrame[property] = 0
// 		}

// 		dom.animateTo(el, endFrame,
// 			duration,
// 			easing
// 		)
// 		.then(onLeaved)
// 	},


// 	jsEnter (onEntered) {
// 		let jsTransition = this.getJSTransition()

// 		if (jsTransition.enter) {
// 			this._transitionCleaner = jsTransition.enter(onEntered)
// 		}
// 		else {
// 			onEntered(true)
// 		}
// 	},


// 	jsLeave (onLeaved) {
// 		let jsTransition = this.getJSTransition()

// 		if (jsTransition.leave) {
// 			this._transitionCleaner = jsTransition.leave(onLeaved)
// 		}
// 		else {
// 			onLeaved(true)
// 		}
// 	},


// 	getJSTransition () {
// 		let {el, vm, name, options} = this
// 		let jsTransitionProto = vm.transitions[name]
// 		let jsTransition = ff.assign({el, vm}, options)
// 		Object.setPrototypeOf(jsTransition, jsTransitionProto)

// 		return jsTransition
// 	},


// 	classEnter (fn) {
// 		let {el, name} = this
// 		let enterClass = name + '-enter'
// 		let {duration, easing} = this.options
// 		let canceled = false

// 		if (duration) {
// 			dom.setCSS(el, 'transition-duration', duration)
// 		}

// 		if (easing) {
// 			dom.setCSS(el, 'transition-timing-function', dom.getAnimationEasing(easing))
// 		}

// 		dom.setCSS(el, 'transition', 'none')
// 		dom.addClass(el, enterClass, enterClass + '-from')

// 		//requestAnimationFrame and then create a micro task to make sure relayout completed
// 		requestAnimationFrame(() => {
// 			queues.pushInnerTask(() => {
// 				if (canceled) {
// 					return
// 				}

// 				if (duration) {
// 					dom.setCSS(el, 'transition-duration', '')
// 				}

// 				if (easing) {
// 					dom.setCSS(el, 'transition-timing-function', '')
// 				}

// 				dom.setCSS(el, 'transition', '')
// 				dom.removeClass(el, enterClass + '-from')
// 				dom.addClass(el, enterClass + '-to')

// 				let onEnd = (finish) => {
// 					dom.removeClass(el, enterClass, enterClass + '-to')
// 					fn(finish)
// 				}

// 				this.onceTransitionEnd(onEnd)
// 			})
// 		})

// 		this._transitionCleaner = () => {
// 			canceled = true
// 		}
// 	},


// 	classLeave (fn) {
// 		let {el, name} = this
// 		let leaveClass = name + '-leave'
// 		let {duration, easing} = this.options
// 		let canceled = false

// 		if (duration) {
// 			dom.setCSS(el, 'transition-duration', duration)
// 		}

// 		if (easing) {
// 			dom.setCSS(el, 'transition-timing-function', dom.getAnimationEasing(easing))
// 		}

// 		dom.addClass(el, leaveClass, leaveClass + '-from')
// 		dom.setCSS(el, 'transition', 'none')

// 		requestAnimationFrame(() => {
// 			queues.pushInnerTask(() => {
// 				if (canceled) {
// 					return
// 				}

// 				if (duration) {
// 					dom.setCSS(el, 'transition-duration', '')
// 				}

// 				if (easing) {
// 					dom.setCSS(el, 'transition-timing-function', '')
// 				}

// 				dom.setCSS(el, 'transition', '')
// 				dom.removeClass(el, leaveClass + '-from')
// 				dom.addClass(el, leaveClass + '-to')

// 				let onEnd = (finish) => {
// 					dom.removeClass(el, leaveClass, leaveClass + '-to')
// 					fn(finish)
// 				}

// 				this.onceTransitionEnd(onEnd)
// 			})
// 		})

// 		this._transitionCleaner = () => {
// 			canceled = true
// 		}
// 	},


// 	clearLastCSSTransitionEndHandler () {
// 		if (this._transitionCleaner) {
// 			this._transitionCleaner()
// 		}
// 	},


// 	onceTransitionEnd (onEnd) {
// 		let {el} = this
// 		let transitionDuration = parseFloat(dom.getCSS(el, 'transition-duration')) || 0
// 		let animationDuration = parseFloat(dom.getCSS(el, 'animation-duration')) || 0
// 		let eventName = transitionDuration > 0 ? 'transitionend' : 'animationend'
// 		let duration = (transitionDuration || animationDuration) * 1000

// 		let onFinish = () => {
// 			this._transitionCleaner = null
// 			dom.setCSS(el, 'pointer-events', '')
// 			onEnd(true)
// 		}

// 		let onTransitionEnd = () => {
// 			defer.cancel()
// 			onFinish()
// 		}

// 		let onTimeout = () => {
// 			dom.off(el, eventName, onTransitionEnd)
// 			onFinish()
// 		}

// 		dom.once(el, eventName, onTransitionEnd)

// 		let defer = ff.defer(onTimeout, duration + 50)

// 		this._transitionCleaner = () => {
// 			defer.cancel()
// 			dom.off(el, eventName, onTransitionEnd)
// 			onEnd(false)
// 		}
// 	},


// 	clear () {
// 		this.clearLastCSSTransitionEndHandler()
// 	},
// }






// /*Transitions*/
// FF.registerTransition('goto', {

// 	target: null,

// 	enter (fn) {
// 		let {el} = this
// 		let transform = this.getTransform()

// 		if (transform) {
// 			dom.animateFrom(
// 				el,
// 				{transform},
// 				this.duration,
// 				this.easing
// 			)
// 			.then(fn)
// 		}
// 		else {
// 			dom.animateFrom(
// 				el,
// 				{opacity: 0}
// 			)
// 			.then(fn)
// 		}

// 		return function () {
// 			el.stopAnimation()
// 		}
// 	},

// 	leave (fn) {
// 		let {el} = this
// 		let transform = this.getTransform()

// 		if (transform) {
// 			dom.animateTo(
// 				el,
// 				{transform},
// 				this.duration,
// 				this.easing
// 			)
// 			.then(fn)
// 		}
// 		else {
// 			dom.animateTo(
// 				el,
// 				{opacity: 0}
// 			)
// 			.then(fn)
// 		}

// 		return function () {
// 			el.stopAnimation()
// 		}
// 	},

// 	getTransform () {
// 		let {el, target} = this
// 		let toEl = typeof target === 'function' ? target() : typeof target === 'string' ? document.querySelector(target) : target

// 		if (!toEl) {
// 			return ''
// 		}

// 		let elBox = dom.getBox(el)
// 		let toBox = dom.getBox(toEl)

// 		let scaleX = (toBox.width  / elBox.width ).toMaxFixed(3)
// 		let scaleY = (toBox.height / elBox.height).toMaxFixed(3)
// 		let translateX = Math.round((toBox.left + toBox.width  / 2) - (elBox.left + elBox.width  / 2))
// 		let translateY = Math.round((toBox.top  + toBox.height / 2) - (elBox.top  + elBox.height / 2))
// 		let transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`

// 		return transform
// 	},
// })




// ff.assign(dom, {

// 	//capture current Frame, and later Frame, play transition
// 	//should behind other "FF.nextTick" which may change style
// 	animateToNextFrame (el, names, duration = dom.defaultAnimationDuration, easing = dom.defaultAnimationEasing) {
// 		if (!el.animate) {
// 			return Promise.resolve()
// 		}

// 		if (typeof names === 'string') {
// 			names = [names]
// 		}

// 		names = names.map(ff.toCamerCase)
// 		easing = dom.getAnimationEasing(easing)
// 		dom.stopAnimation(el)

// 		let startFrame = {}
// 		for (let name of names) {
// 			startFrame[name] = dom.getCSS(el, name)
// 		}

// 		return new Promise ((resolve) => {
// 			FF.nextTick(() => {
// 				let endFrame = {}
// 				for (let name of names) {
// 					endFrame[name] = dom.getCSS(el, name)
// 				}

// 				let animation = el[dom.animationSymbol] = el.animate([startFrame, endFrame], {
// 					easing,
// 					duration,
// 				})

// 				animation.addEventListener('finish', () => {
// 					delete el[dom.animationSymbol]
// 					resolve(true)
// 				}, false)

// 				animation.addEventListener('cancel', () => {
// 					delete el[dom.animationSymbol]
// 					resolve(false)
// 				}, false)
// 			})
// 		})
// 	},
// })