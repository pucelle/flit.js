import {Emitter} from './emitter'
import {RootPart, TemplateResult} from './parts'
import {enqueueComponentUpdate} from './queue'
import {startUpdating, endUpdating, observeCom, clearDependency, clearAsDependency} from './observer'
import {WatchFn, WatcherDisconnectFn, WatcherCallback, Watcher} from './watcher'


/** Returns the typeof T[P]. */
type ValueType<T, P extends keyof T> = T extends {[key in P]: infer R} ? R : never


/** The constructor type of component class. */
export type ComponentConstructor = {
    new(el: HTMLElement): Component
}


const componentMap: Map<string, ComponentConstructor> = new Map()

/**
 * Define a component with specified name and class, called by `define()`.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function defineComponent(name: string, Com: ComponentConstructor) {
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
	com.onCreated()
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


/** The abstract component class, you can instantiate it from just create an element, or call `render()` if you want to config it. */
export abstract class Component<Events = any> extends Emitter<Events> {

	static get = getComponentAtElement
	static getAsync = getComponentAtElementAsync

	el: HTMLElement
	refs: {[key: string]: Element} = {}

	private __node: RootPart | null = null
	private __firstRendered: boolean = false
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
	}

	__emitConnected() {
		this.__connected = true

		this.update()
		this.onConnected()

		if (this.__watchers) {
			for (let watcher of this.__watchers) {
				watcher.connect()
			}
		}
	}

	__emitDisconnected() {
		clearDependency(this)
		clearAsDependency(this)

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

		startUpdating(this)
		let value = this.render()
		endUpdating()

		if (this.__node) {
			this.__node.update(value)
		}
		else {
			this.__node = new RootPart(this.el, value, this)
		}

		if (!this.__firstRendered) {
			this.__firstRendered = true
			this.onFirstRendered()
		}

		this.onRendered()
	}

	/** Child class should implement this method, normally returns html`...` or string. */
	abstract render(): string | TemplateResult

	/**
	 * Call this to partially or fully update asynchronously if needed.
	 * You should not overwrite this method until you know what you are doing.
	 */
	update() {
		enqueueComponentUpdate(this)
	}

	/** Called when component instance was just created and all properties assigned. */
	onCreated() {}

	/** Called when rendered for the first time. */
	onFirstRendered() {}

	/** Called when rendered for every time. */
	onRendered() {}

	/** 
	 * Called when root element inserted into document.
	 * This will be called for each time you insert the element into document.
	 * The first time to trigger this would be earlier than onFirstRendered.
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


	/** Watch return value of function and trigger callback with this value as argument. */
	watch<FN extends WatchFn>(fn: FN, callback: (value: ReturnType<FN>) => void): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments. */
	watch<FN1 extends WatchFn, FN2 extends WatchFn>(
		fn1: FN1,
		fn2: FN2,
		callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>) => void
	): WatcherDisconnectFn

	/** Watch return values of functions and trigger callback with these values as arguments. */
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
