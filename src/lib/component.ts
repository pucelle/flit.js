import {Emitter} from './emitter'
import {RootPart, TemplateResult} from './parts'
import {enqueueComponentUpdate} from './queue'
import {startUpdating, endUpdating, observeCom, clearDependency, clearAsDependency} from './observer'
import {watch, WatchFn, Callback, WatcherDisconnectFn} from './watcher'


/** The constructor type of component class. */
export type ComponentConstructor = {
    new(el: HTMLElement, options?: object): Component
}

type NonMethodNames<T> = { [P in keyof T]: T[P] extends Function ? never : P }[keyof T]
type NMOCN<T> = Exclude<NonMethodNames<T>, keyof Component> & string	//NonMethodOrComponentNames


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
	private __watcherDisconnectFns: Set<WatcherDisconnectFn> | null = null

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
		this.update()
		this.onConnected()
	}

	__emitDisconnected() {
		clearDependency(this)
		clearAsDependency(this)
	}

	__updateImmediately() {
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

	/**
	 * Watch
	 */
	watch(fn: WatchFn, callback: Callback): WatcherDisconnectFn
	watch(fn_1: WatchFn, fn_2: WatchFn, callback: Callback): WatcherDisconnectFn
	watch(fn_1: WatchFn, fn_2: WatchFn, fn_3: WatchFn, callback: Callback): WatcherDisconnectFn
	watch(fn_1: WatchFn, fn_2: WatchFn, fn_3: WatchFn, fn_4: WatchFn, callback: Callback): WatcherDisconnectFn
	watch(fn_1: WatchFn, fn_2: WatchFn, fn_3: WatchFn, fn_4: WatchFn, fn_5: WatchFn, callback: Callback): WatcherDisconnectFn

	watch(prop: NMOCN<this>, callback: Callback): WatcherDisconnectFn
	watch(prop_1: NMOCN<this>, prop_2: NMOCN<this>, callback: Callback): WatcherDisconnectFn
	watch(prop_1: NMOCN<this>, prop_2: NMOCN<this>, prop_3: NMOCN<this>, callback: Callback): WatcherDisconnectFn
	watch(prop_1: NMOCN<this>, prop_2: NMOCN<this>, prop_3: NMOCN<this>, prop_4: NMOCN<this>, callback: Callback): WatcherDisconnectFn
	watch(prop_1: NMOCN<this>, prop_2: NMOCN<this>, prop_3: NMOCN<this>, prop_4: NMOCN<this>, prop_5: NMOCN<this>, callback: Callback): WatcherDisconnectFn

	watch(...fnOrPropsAndCallback: unknown[]): WatcherDisconnectFn {
		for (let i = 0; i < fnOrPropsAndCallback.length; i++) {
			if (typeof fnOrPropsAndCallback[i] === 'string') {
				let prop = fnOrPropsAndCallback[i]
				fnOrPropsAndCallback[i] = () => this[prop as keyof this]
			}
		}

		let disconnectFn = (watch as any)(...fnOrPropsAndCallback)
		this.__watcherDisconnectFns = this.__watcherDisconnectFns || new Set()
		this.__watcherDisconnectFns.add(disconnectFn)

		return () => {
			disconnectFn()
			if (this.__watcherDisconnectFns) {
				this.__watcherDisconnectFns.delete(disconnectFn)
			}
		}
	}
}
