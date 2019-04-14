import {Emitter} from './emitter'
import {RootPart, TemplateResult} from './parts'
import {enqueueComponentUpdate, onRenderComplete} from './queue'
import {startUpdating, endUpdating, observeCom, clearDependency, clearAsDependency} from './observer'
import {WatchFn, WatcherDisconnectFn, WatcherCallback, Watcher} from './watcher'


/** Returns the typeof T[P]. */
type ValueType<T, P extends keyof T> = T extends {[key in P]: infer R} ? R : never
export type ComponentStyle = TemplateResult | string | (() => TemplateResult | string)

/** The constructor type of component class. */
export type ComponentConstructor = {
	new(el: HTMLElement): Component
	style: ComponentStyle | null
	properties: string[] | null
}


const componentMap: Map<string, ComponentConstructor> = new Map()

/**
 * Define a component with specified name and class, called by `define()`.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function defineComponent(name: string, Com: ComponentConstructor) {
	if (componentMap.has(name)) {
		console.warn(`You are trying to overwrite component definition "${name}"`)
	}

	if (Com.properties && Com.properties.some(p => /A-Z/.test(p))) {
		let prop = Com.properties.find(p => /A-Z/.test(p))!
		let dashProp = prop.replace(/A-Z/g, (m0: string) => '-' + m0.toLowerCase())
		throw new Error(`Static properties "${prop}" are used in HTML element and should not be camel case type, you may use "${dashProp}" instead.`)
	}

	componentMap.set(name, Com)
}

/**
 * Get component constructor from name, then we can instantiate it.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function getComponentConstructorByName(name: string): ComponentConstructor | undefined {
	return componentMap.get(name)
}


const componentCreatedMap: WeakMap<HTMLElement, ((com: Component) => void)[]> = new WeakMap()

/** Call callbacks after component instance created. */
export function onComponentCreatedAt(el: HTMLElement, callback: (com: Component) => void) {
	let callbacks = componentCreatedMap.get(el)
	if (!callbacks) {
		componentCreatedMap.set(el, (callbacks = []))
	}
	callbacks.push(callback)
}

/** may assign properties from `:props`, or bind component events from `@com-event` */
export function emitComponentCreatedCallbacks(el: HTMLElement, com: Component) {
	let callbacks = componentCreatedMap.get(el)
	if (callbacks) {
		for (let callback of callbacks) {
			callback(com)
		}
		componentCreatedMap.delete(el)
	}
}


const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()

/**
 * Get component instance from root element.
 * @param el The element to get component instance at.
 */
export function getComponentAtElement(el: HTMLElement): Component | undefined {
	return elementComponentMap.get(el)
}

/**
 * Get component instance from root element asynchronously.
 * @param el The element to get component instance at.
 */
export function getComponentAtElementAsync(el: HTMLElement): Promise<Component | undefined> {
	if (el.localName.includes('-')) {
		let com = elementComponentMap.get(el)
		if (com) {
			return Promise.resolve(com)
		}
		else {
			return new Promise(resolve => {
				onComponentCreatedAt(el, resolve)
			})
		}
	}
	else {
		return Promise.resolve(undefined)
	}
}


const componentSet: Set<Component> = new Set()

/** Update all components, e.g., when current language changed. */
export function updateComponents() {
	for (let com of componentSet) {
		com.update()
	}
}


interface ComponentEvents {
	created: () => void
	firstRendered: () => void
	rendered: () => void
	connedted: () => void
	disconnected: () => void
}

/** The abstract component class, you can instantiate it from just creating an element and insert in to document. */
export abstract class Component<Events = {}> extends Emitter<Events & ComponentEvents> {

	static get = getComponentAtElement
	static getAsync = getComponentAtElementAsync

	/**
	 * The static `style` property contains style text used as styles for current component.
	 * Styles in it will be partialy scoped, so we have benefits of scoped styles,
	 * and also avoid the problems in sharing styles.
	 * 
	 * symbol `$` in class name will be replaced to current component name:
	 * `.$title` -> `.title__com-name`
	 * 
	 * tag selector will be nested in com-name selector:
	 * `p` -> `com-name p`
	 */
	static style: ComponentStyle | null = null

	/**
	 * Used to assign very important value type properties,
	 * Normally used to set the properties that will never changed.
	 */
	static properties: string[] | null = null

	/** The root element of component. */
	el: HTMLElement

	/**
	 * The reference map object of element inside.
	 * You can specify `:ref="refName"` on an element,
	 * or using `:ref=${this.onRef}` to call `this.onRef(refElement)` every time when the reference element updated.
	 */
	refs: {[key: string]: HTMLElement} = {}
	slots: {[key: string]: HTMLElement[]} = {}

	private __restNodes: Node[] | null = null
	private __rootPart: RootPart | null = null
	private __firstUpdated: boolean = false
	private __watchers: Set<Watcher> | null = null
	private __connected: boolean = true

	constructor(el: HTMLElement) {
		super()
		this.el = el
		return observeCom(this) as Component
	}

	__emitFirstConnected() {
		elementComponentMap.set(this.el, this)
		emitComponentCreatedCallbacks(this.el, this)
		this.onCreated()

		// A typescript issue here:
		// We accept an `Events` and union it with type `ComponentEvents`,
		// the returned type for `rendered` property will become `Events['rendered'] & () => void`,
		// `Parmaters<...>` of it will return the arguments of `Events['rendered']`.
		// So here show the issue that passed arguments `[]` can't be assigned to it.

		// This can't be fixed right now since we can't implement a type function like `interface extends`
		// And the type function below not work as expected:
		// `type Extends<B, O> = {[key in keyof (B & O)]: key extends keyof O ? O[key] : key extends keyof B ? B[key] : never}`
		;(this as any).emit('created')
	}

	__emitConnected() {
		this.__connected = true
		this.update()

		this.onConnected()
		;(this as any).emit('connected')

		if (this.__watchers) {
			for (let watcher of this.__watchers) {
				watcher.connect()
			}
		}

		componentSet.add(this)
	}

	__emitDisconnected() {
		clearDependency(this)
		clearAsDependency(this)
		componentSet.delete(this)

		this.onDisconnected()
		;(this as any).emit('disconnected')

		if (this.__watchers) {
			for (let watcher of this.__watchers) {
				watcher.disconnect()
			}
		}

		this.__connected = false
	}

	__updateImmediately() {
		if (!this.__connected) {
			return
		}

		let firstUpdated = this.__firstUpdated
		if (!firstUpdated) {
			//this.onChildNodesReady()
			this.__parseSlots()
			//this.onSlotsReady()
			this.__firstUpdated = true
		}

		let part = this.__rootPart

		startUpdating(this)
		let value = this.render()

		if (part) {
			part.update(value)
		}
		// Not overwrite `render()` to keep it returns `null` when you to do nothing in child nodes.
		// But note that if it should not return `null` when updating, and you may need `<slot />` instead.
		else if (value !== null) {
			part = new RootPart(this.el, value, this)
		}

		endUpdating(this)

		// Move it to here to avoid observing `__part`.
		if (this.__rootPart !== part) {
			this.__rootPart = part
		}

		onRenderComplete(() => {
			if (!firstUpdated) {
				this.onFirstRendered()
				;(this as any).emit('firstRendered')
			}
			
			this.onRendered()
			;(this as any).emit('rendered')
		})
	}

	// May first rendered as text, then original child nodes was removed.
	// Then have slots when secondary rendering.
	private __parseSlots() {
		if (this.el.children.length > 0) {
			// We only check `[slot]` in the children, or:
			// <com1><com2><el slot="for com2"></com2></com1>
			// it will cause `slot` for `com2` was captured by `com1`.
			for (let el of this.el.children) {
				let slotName = el.getAttribute('slot')!
				if (slotName) {
					let els = this.slots[slotName]
					if (!els) {
						els = this.slots[slotName] = []
					}
					els.push(el as HTMLElement)

					// Avoid been treated as slot element again after moved into a component
					el.removeAttribute('slot')

					el.remove()
				}
			}
		}

		if (this.el.childNodes.length > 0) {
			this.__restNodes = [...this.el.childNodes]
		}
	}

	__moveSlotsInto(fragment: DocumentFragment) {
		let slots = fragment.querySelectorAll('slot')

		for (let slot of slots) {
			let slotName = slot.getAttribute('name')
			if (slotName) {
				if (this.slots && this.slots[slotName]) {
					while (slot.firstChild) {
						slot.firstChild.remove()
					}
					slot.append(...this.slots[slotName]!)
				}
			}
			else if (this.__restNodes) {
				while (slot.firstChild) {
					slot.firstChild.remove()
				}
				slot.append(...this.__restNodes)
			}
		}
	}

	/** Child class should implement this method, normally returns html`...` or string. */
	render(): TemplateResult | string |  null {
		return null
	}

	/**
	 * Call this to partially or fully update asynchronously if needed.
	 * You should not overwrite this method until you know what you are doing.
	 */
	update() {
		enqueueComponentUpdate(this)
	}

	/**
	 * Called when component instance was just created and all properties assigned.
	 * Slots and child nodes are not prepared right now.
	 */
	onCreated() {}

	/** Called after child nodes and sibling nodes prepared, before slot nodes parsed and first rendering. */
	// Recently we want to reduce the directly operating on elements, but move them to the template and data management.
	// So this interface and `onSlotsReady` is not available.
	//onChildNodesReady() {}

	/** Called just after `onChildNodesReady` and slots parsed */
	//onSlotsReady()

	/**
	 * Called when rendered for the first time.
	 * Slots and and child nodes are prepared right now.
	 */
	onFirstRendered() {}

	/** Called when all the enqueued components rendered. */
	onRendered() {}

	/** 
	 * Called when root element inserted into document.
	 * This will be called for each time you insert the element into document.
	 */
	onConnected() {}

	/**
	 * Called when root element removed from document.
	* This will be called for each time you removed the element into document.
	 * If you registered global listeners, don't forget to unregister it here.
	 */
	onDisconnected() {}


	/** Watch specified property and call callback with the value as argument after it changed. */
	watch<P extends keyof this>(prop: P, callback: (value: ValueType<this, typeof prop>) => void): WatcherDisconnectFn

	/** Watch specified properties and call callback with these values as arguments after they changed. */
	watch<P1 extends keyof this, P2 extends keyof this, P3 extends keyof this>(
		prop1: P1,
		prop2: P2,
		callback: (value1: ValueType<this, P1>, value2: ValueType<this, P2>) => void
	): WatcherDisconnectFn

	/** Watch specified properties and call callback with these values as arguments after they changed. */
	watch<P1 extends keyof this, P2 extends keyof this, P3 extends keyof this>(
		prop1: P1,
		prop2: P2,
		prop3: P3,
		callback: (value1: ValueType<this, P1>, value2: ValueType<this, P2>, value3: ValueType<this, P3>) => void
	): WatcherDisconnectFn


	/** Watch return value of function and trigger callback with this value as argument after it changed. */
	watch<FN extends WatchFn>(fn: FN, callback: (value: ReturnType<FN>) => void): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments after they changed. */
	watch<FN1 extends WatchFn, FN2 extends WatchFn>(
		fn1: FN1,
		fn2: FN2,
		callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>) => void
	): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments after they changed. */
	watch<FN1 extends WatchFn, FN2 extends WatchFn, FN3 extends WatchFn>(
		fn1: FN1,
		fn2: FN2,
		fn3: FN3,
		callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>, value3: ReturnType<FN3>) => void
	): WatcherDisconnectFn


	watch(...fnOrPropsAndCallback: unknown[]): WatcherDisconnectFn {
		let callback = fnOrPropsAndCallback.pop() as WatcherCallback

		for (let i = 0; i < fnOrPropsAndCallback.length; i++) {
			if (typeof fnOrPropsAndCallback[i] === 'string') {
				let prop = fnOrPropsAndCallback[i]
				fnOrPropsAndCallback[i] = () => this[prop as keyof this]
			}
		}

		let watcher = new Watcher(fnOrPropsAndCallback as WatchFn[], callback)
		
		this.__watchers = this.__watchers || new Set()
		this.__watchers.add(watcher)

		return () => {
			watcher.disconnect()

			if (this.__watchers) {
				this.__watchers.delete(watcher)
			}
		}
	}

		
	/** Watch specified property and call callback with the value as argument later and after it changed. */
	watchImmediately<P extends keyof this>(prop: P, callback: (value: ValueType<this, typeof prop>) => void): WatcherDisconnectFn

	/** Watch specified properties and call callback with these values as arguments later and after they changed. */
	watchImmediately<P1 extends keyof this, P2 extends keyof this, P3 extends keyof this>(
		prop1: P1,
		prop2: P2,
		callback: (value1: ValueType<this, P1>, value2: ValueType<this, P2>) => void
	): WatcherDisconnectFn

	/** Watch specified properties and call callback with these values as arguments later and after they changed. */
	watchImmediately<P1 extends keyof this, P2 extends keyof this, P3 extends keyof this>(
		prop1: P1,
		prop2: P2,
		prop3: P3,
		callback: (value1: ValueType<this, P1>, value2: ValueType<this, P2>, value3: ValueType<this, P3>) => void
	): WatcherDisconnectFn


	/** Watch return value of function and trigger callback with this value as argument later and after it changed.. */
	watchImmediately<FN extends WatchFn>(fn: FN, callback: (value: ReturnType<FN>) => void): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments later and after they changed. */
	watchImmediately<FN1 extends WatchFn, FN2 extends WatchFn>(
		fn1: FN1,
		fn2: FN2,
		callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>) => void
	): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments later and after they changed. */
	watchImmediately<FN1 extends WatchFn, FN2 extends WatchFn, FN3 extends WatchFn>(
		fn1: FN1,
		fn2: FN2,
		fn3: FN3,
		callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>, value3: ReturnType<FN3>) => void
	): WatcherDisconnectFn


	watchImmediately(...fnOrPropsAndCallback: unknown[]): WatcherDisconnectFn {
		let callback = fnOrPropsAndCallback.pop() as WatcherCallback

		for (let i = 0; i < fnOrPropsAndCallback.length; i++) {
			if (typeof fnOrPropsAndCallback[i] === 'string') {
				let prop = fnOrPropsAndCallback[i]
				fnOrPropsAndCallback[i] = () => this[prop as keyof this]
			}
		}

		let watcher = new Watcher(fnOrPropsAndCallback as WatchFn[], callback, true)
		
		this.__watchers = this.__watchers || new Set()
		this.__watchers.add(watcher)

		return () => {
			watcher.disconnect()

			if (this.__watchers) {
				this.__watchers.delete(watcher)
			}
		}
	}

	
	/** Watch specified property and call callback with the value as argument after it changed. Trigger callback for only once. */
	watchOnce<P extends keyof this>(prop: P, callback: (value: ValueType<this, typeof prop>) => void): WatcherDisconnectFn

	/** Watch specified properties and call callback with these values as arguments after they changed. Trigger callback for only once. */
	watchOnce<P1 extends keyof this, P2 extends keyof this, P3 extends keyof this>(
		prop1: P1,
		prop2: P2,
		callback: (value1: ValueType<this, P1>, value2: ValueType<this, P2>) => void
	): WatcherDisconnectFn

	/** Watch specified properties and call callback with these values as arguments after they changed. Trigger callback for only once. */
	watchOnce<P1 extends keyof this, P2 extends keyof this, P3 extends keyof this>(
		prop1: P1,
		prop2: P2,
		prop3: P3,
		callback: (value1: ValueType<this, P1>, value2: ValueType<this, P2>, value3: ValueType<this, P3>) => void
	): WatcherDisconnectFn


	/** Watch return value of function and trigger callback with this value as argument. Trigger callback for only once. */
	watchOnce<FN extends WatchFn>(fn: FN, callback: (value: ReturnType<FN>) => void): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments. */
	watchOnce<FN1 extends WatchFn, FN2 extends WatchFn>(
		fn1: FN1,
		fn2: FN2,
		callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>) => void
	): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments. Trigger callback for only once. */
	watchOnce<FN1 extends WatchFn, FN2 extends WatchFn, FN3 extends WatchFn>(
		fn1: FN1,
		fn2: FN2,
		fn3: FN3,
		callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>, value3: ReturnType<FN3>) => void
	): WatcherDisconnectFn


	watchOnce(...fnOrPropsAndCallback: unknown[]): WatcherDisconnectFn {
		let callback = fnOrPropsAndCallback.pop() as WatcherCallback

		let wrappedCallback = (values: any[]) => {
			callback(...values)
			disconnect()
		}

		for (let i = 0; i < fnOrPropsAndCallback.length; i++) {
			if (typeof fnOrPropsAndCallback[i] === 'string') {
				let prop = fnOrPropsAndCallback[i]
				fnOrPropsAndCallback[i] = () => this[prop as keyof this]
			}
		}

		let watcher = new Watcher(fnOrPropsAndCallback as WatchFn[], wrappedCallback)

		this.__watchers = this.__watchers || new Set()
		this.__watchers.add(watcher)

		let disconnect = () => {
			watcher.disconnect()

			if (this.__watchers) {
				this.__watchers.delete(watcher)
			}
		}

		return disconnect
	}


	/** Watch returned values of function and trigger callback if it becomes true. */
	watchUntil(prop: keyof this, callback: () => void): WatcherDisconnectFn {
		if (this[prop]) {
			callback()
			return () => {}
		}

		let fn = () => this[prop]

		let wrappedCallback = ([value]: any[]) => {
			if (value) {
				callback()
				disconnect()
			}
		}

		let watcher = new Watcher([fn], wrappedCallback)

		this.__watchers = this.__watchers || new Set()
		this.__watchers.add(watcher)

		let disconnect = () => {
			watcher.disconnect()

			if (this.__watchers) {
				this.__watchers.delete(watcher)
			}
		}

		return disconnect
	}
}
