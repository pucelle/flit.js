import {Emitter} from './emitter'
import {NodePart, AnchorNode, TemplateResult} from './parts'
import {enqueueComponentUpdate} from './queue'
import {startUpdating, endUpdating, observeComTarget, clearDependencies, clearAsDependency} from './observer'
import {Watcher, globalWatcherSet} from './watcher'
import {targetMap} from './observer/shared'
import {restoreAsDependency} from './observer/dependency'
import {getScopedClassNameSet} from './style'
import {AnchorNodeType} from './parts/shared'
import {DirectiveResult} from './directives'


/** Returns the typeof T[P]. */
export type ComponentStyle = TemplateResult | string | (() => TemplateResult | string)

/** The constructor type of component class. */
export type ComponentConstructor = {
	new(el: HTMLElement): Component
	style: ComponentStyle | null
	properties: string[] | null
}

/** Context may be `null` when using `render` or `renderAndUpdate` */
export type Context = Component | null


/** To cache `name -> component constructor` */
const componentConstructorMap: Map<string, ComponentConstructor> = new Map()

/**
 * Define a component with specified name and class, called by `define()`.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function defineComponent(name: string, Com: ComponentConstructor) {
	if (componentConstructorMap.has(name)) {
		console.warn(`You are trying to overwrite component definition "${name}"`)
	}

	// `properties` can be camel cased or dash cased.
	if (Com.properties) {
		for (let i = 0; i < Com.properties.length; i++) {
			let prop = Com.properties[i]
			if (/[A-Z]/.test(prop)) {
				Com.properties[i] = prop.replace(/[A-Z]/g, (m0: string) => '-' + m0.toLowerCase())
			}
		}
	}

	componentConstructorMap.set(name, Com)
}

/**
 * Get component constructor from name, then we can instantiate it.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function getComponentConstructorByName(name: string): ComponentConstructor | undefined {
	return componentConstructorMap.get(name)
}


/** To cache callbacks after component initialized */
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


/** To cache `el -> com` map */
const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()

/**
 * Get component instance from root element.
 * @param el The element to get component instance at.
 */
export function getComponent(el: HTMLElement): Component | undefined {
	return elementComponentMap.get(el)
}

/**
 * Get component instance from root element asynchronously.
 * @param el The element to get component instance at.
 */
export function getComponentAsync(el: HTMLElement): Promise<Component | undefined> {
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


/** To mark all the connected components */
const componentSet: Set<Component> = new Set()

/** Update all components, e.g., when current language changed. */
export function updateComponents() {
	for (let watcher of globalWatcherSet) {
		watcher.update()
	}

	for (let com of componentSet) {
		com.update()
		com.__updateWatchers()
	}
}


// Why not provide event interfaces to listen to:
// There are event functions like `onCreated` to overwrite,
// you should implement the logic in them,
// it's easier to manage since they are inside component's codes.

// You can easily know when these events are triggered.
//   created: just get component and do something.
//   firstUpdated: watch properties using in `render` for once.
//   updated: watch properties using in `render`.
//   disconnedted: in where element was removed.

// What about `updated` event?
// `updated` is not semantic enough, you know it's updated, but not what is truly updated.
// You may need to do something like adjusting outer component's position,
// the best way to do so is to know when it should be updated.
// E.g., The component updating because the data flow into it from the outer component,
// according to the `:prop...` in outer `render()` function, then you should do it in outer `onUpdated`.

/** The abstract component class, you can instantiate it from just creating an element and insert in to document. */
export abstract class Component<Events = any> extends Emitter<Events> {

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
	 * Can be camel cased or dash cased.
	 */
	static properties: string[] | null = null

	/** The root element of component. */
	el: HTMLElement

	/**
	 * The reference map object of element inside.
	 * You can specify `:ref="refName"` on an element,
	 * or using `:ref=${this.onRef}` to call `this.onRef(refElement)` every time when the reference element updated.
	 */

	//Should be `Element` type, but in 99% scenarios it's HTMLElement.
	refs: {[key: string]: HTMLElement} = {}
	slots: {[key: string]: HTMLElement[]} = {}

	private __restNodes: Node[] | null = null
	private __rootPart: NodePart | null = null
	private __updated: boolean = false
	private __watchers: Set<Watcher> | null = null
	private __connected: boolean = true

	// When updated inner templates and found there are slots need to be filled.
	// Why not just move slots into template fragment?
	// Because it will trigger `connectedCallback` when append into fragment.
	__hasSlotsToBeFilled: boolean = false

	constructor(el: HTMLElement) {
		super()
		this.el = el
		return observeComTarget(this)
	}

	__emitCreated() {
		elementComponentMap.set(this.el, this)
		emitComponentCreatedCallbacks(this.el, this)
		this.onCreated()

		// Must parse here, the slot elements may not in use now,
		// Parse them here will remove slot element so they will not be connected.
		this.__prepareSlotElements()

		// A typescript issue here:
		// We accept an `Events` and union it with type `ComponentEvents`,
		// the returned type for `rendered` property will become `Events['rendered'] & () => void`,
		// `Parmaters<...>` of it will return the arguments of `Events['rendered']`.
		// So here show the issue that passed arguments `[]` can't be assigned to it.

		// This can't be fixed right now since we can't implement a type function like `interface extends`
		// And the type function below not work as expected:
		// `type Extends<B, O> = {[key in keyof (B & O)]: key extends keyof O ? O[key] : key extends keyof B ? B[key] : never}`
		
		// this.emit('created')
	}

	// May first rendered as text, then original child nodes was removed.
	// Then have slots when secondary rendering.
	private __prepareSlotElements() {
		if (this.el.children.length > 0) {
			// We only check `[slot]` in the children, or:
			// <com1><com2><el slot="for com2"></com2></com1>
			// it will cause `slot` for `com2` was captured by `com1`.
			for (let el of [...this.el.children]) {
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
	}

	private __fillSlots() {
		let slots = this.el.querySelectorAll('slot')

		for (let slot of slots) {
			let slotName = slot.getAttribute('name')
			if (slotName) {
				if (this.slots && this.slots[slotName]) {
					slot.replaceWith(...this.slots[slotName]!)
				}
			}
			else if (this.__restNodes) {
				slot.replaceWith(...this.__restNodes)
			}
		}
	}

	__emitConnected() {
		// Not do following things when firstly connected.
		if (!this.__connected) {
			this.__connected = true
			
			if (this.__watchers) {
				for (let watcher of this.__watchers) {
					watcher.connect()
				}
			}

			// Must restore before updating, because the restored result may be changed when updating.
			restoreAsDependency(targetMap.get(this)!)
		}

		// Why `update` but not `__updateImmediately`?
		// After component created, it may delete element in `onCreated`
		// Then in following micro task, it's `__connected` becomes false,
		// and truly not been updated finally.
		this.update()
		componentSet.add(this)
	}

	__emitDisconnected() {
		clearDependencies(this)

		// We generated `updatable proxy -> dependency target` maps in dependency module,
		// So here need to pass component target to clear dependencies.
		clearAsDependency(targetMap.get(this)!)

		componentSet.delete(this)
		this.onDisconnected()

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
		let result = this.render()
		endUpdating(this)

		if (this.__rootPart) {
			this.__rootPart.update(result)
		}

		// Not overwrite `render()` to keep it returns `null` when you to do nothing in child nodes.
		// But note that if it should not return `null` when updating, and you may need `<slot />` instead.
		else if (result !== null) {

			// It's very import to cache rest nodes here, because child nodes may be removed in their `onCreated`.
			// If we cache them eraly before they were removed, will restore them in filling `<slot />`.
			if (this.el.childNodes.length > 0) {
				this.__restNodes = [...this.el.childNodes]
			}
			this.__rootPart = new NodePart(new AnchorNode(this.el, AnchorNodeType.Root), result, this)
		}

		if (this.__hasSlotsToBeFilled) {
			this.__fillSlots()
			this.__hasSlotsToBeFilled = false
		}

		let isFirstlyUpdate = !this.__updated
		if (isFirstlyUpdate) {
			this.onReady()
			this.__updated = true
		}
		
		this.onUpdated()
	}

	/** Child class should implement this method, normally returns html`...` or string. */
	render(): TemplateResult | string | DirectiveResult |  null {
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
	 * Original child nodes are prepared, but slots are not prepared right now.
	 * You may changed some data or visit parent nodes or `this.el` and operate here.
	 */
	onCreated() {}

	/**
	 * Called after all the data updated for the first time.
	 * Child nodes are rendered, slots are prepared, but child components are not.
	 * Will keep updating other components, so please don't check computed styles on elements.
	 * You may visit child nodes or bind events here.
	 */
	onReady() {}

	/** 
	 * Called after all the data updated.
	 * Will keep updating other components, so please don't check computed style on elements.
	 */
	onUpdated() {}

	/**
	 * Called when root element removed from document.
	 * This will be called for each time you removed the element into document.
	 * If you registered global listeners, don't forget to unregister it here.
	 */
	onDisconnected() {}

	/** 
	 * Add a watcher to connected with current component.
	 * So it will be disconnected after current component disconnected,
	 * and connected again after current component connected.
	 */
	__addWatcher(watcher: Watcher) {
		this.__watchers = this.__watchers || new Set()
		this.__watchers.add(watcher)
	}

	/** Delete one watcher belongs to current component, `__watchers` must be exist. */
	__deleteWatcher(watcher: Watcher) {
		this.__watchers!.delete(watcher)
	}

	/** Update all the watchers, used at `updateComponents`. */
	__updateWatchers() {
		if (this.__watchers) {
			for (let watcher of this.__watchers) {
				watcher.update()
			}
		}
	}

	/** Watch return value of function and trigger callback with this value as argument after it changed. */
	watch<T>(fn: () => T, callback: (value: T) => void): () => void {
		let watcher = new Watcher(fn, callback)
		this.__addWatcher(watcher)

		return () => {
			watcher.disconnect()
			this.__watchers!.delete(watcher)
		}
	}

	/** Watch return value of function and trigger callback with this value as argument later and after it changed.. */
	watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
		let watcher = new Watcher(fn, callback)
		callback(watcher.value)
		this.__addWatcher(watcher)

		return () => {
			watcher.disconnect()
			this.__deleteWatcher(watcher)
		}
	}

	/** Watch return value of function and trigger callback with this value as argument. Trigger callback for only once. */
	watchOnce<T>(fn: () => T, callback: (value: T) => void): () => void {
		let wrappedCallback = (value: T) => {
			callback(value)
			disconnect()
		}

		let watcher = new Watcher(fn, wrappedCallback)
		this.__addWatcher(watcher)

		let disconnect = () => {
			watcher.disconnect()
			this.__deleteWatcher(watcher)
		}

		return disconnect
	}

	/** Watch return value of function and trigger callback with this value as argument. Trigger callback for only once. */
	watchUntil<T>(fn: () => T, callback: () => void): () => void {
		let wrappedCallback = (value: T) => {
			if (value) {
				callback()
				disconnect()
			}
		}

		let disconnect: () => void

		let watcher = new Watcher(fn, wrappedCallback)
		if (watcher.value) {
			watcher.disconnect()
			callback()
			disconnect = () => {}
		}
		else {
			this.__addWatcher(watcher)

			disconnect = () => {
				watcher.disconnect()
				this.__deleteWatcher(watcher)
			}
		}

		return disconnect
	}

	/** returns scoped class name E `.name -> .name__com-name` */
	scopeClassName(className: string): string {
		let startsWithDot = className[0] === '.'
		let classNameWithoutDot = startsWithDot ? className.slice(1) : className
		let scopedClassNameSet = getScopedClassNameSet(this.el.localName)

		if (scopedClassNameSet && scopedClassNameSet.has(classNameWithoutDot)) {
			return className + '__' + this.el.localName
		}
		else {
			return className
		}
	}
}
