import {NodePart, TemplateResult} from '../template'
import {NodeAnchorType, NodeAnchor} from "../internals/node-anchor"
import type {DirectiveResult} from '../directives'
import {onComponentConnected, onComponentDisconnected} from './life-cycle'
import {EventEmitter} from '@pucelle/event-emitter'
import type {ComponentStyle} from './style'
import {getScopedClassNames} from '../internals/style-parser'
import {ContainerRange} from '../internals/node-range'
import {WatcherGroup, enqueueUpdatableInOrder, startUpdating, endUpdating, observeComponentTarget, clearDependenciesOf, UpdatableContext, QueueUpdateOrder} from '@pucelle/flit-basis'


/** 
 * Context is the scope when compiling a template.
 * When uses `render` or `renderComponent`, you can choose to pass a context parameter,
 * So the `@click=${eventHandler}` can capture right context.
 * Context may be `null`, in this senoario current template should be context-free.
 */
export type Context = Component | null


export interface ComponentEvents {

	/** After component created and properties assigned. */
	created: () => void

	/** 
	 * After element was inserted into document.
	 * Will trigger after creation, and every time re-insert the component into document.
	 */
	connected: () => void

	/** 
	 * After element was removed from document.
	 * Will trigger after every time the component being removed.
	 */
	disconnected: () => void

	/** 
	 * After all the data, child nodes, directives are prepared,
	 * but child components are still not prepared yet and will be linked in next micro task.
	 * If need to check computed styles on child nodes,
	 * uses `onRenderComplete` or `untilRenderComplete` APIs.
	 */
	ready: () => void

	/** 
	 * After every time all the data and child nodes updated.
	 * If need to check computed styles on child nodes,
	 * uses `onRenderComplete`, `untilRenderComplete` APIs, or `rendered` event.
	 */
	updated: () => void
}


/** 
 * Super class of all the components, create automacially when element being inserting into document.
 * @typeparam E Event interface in `{eventName: (...args) => void}` format.
 */
export abstract class Component<E = {}> extends EventEmitter<E & ComponentEvents> implements UpdatableContext {
	

	__getAttactedDomElement() {
		return this.el
	}

	__comparePositionWith(com: Component) {
		return this.el.compareDocumentPosition(com.el) & com.el.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
	}


	/**
	 * Generate style text used as styles for current component.
	 * Class names will be scoped as `.className__componentName`.
	 * Tag selector will be nested as: `p` -> `com-name p`.
	 * 
	 * You can nest css codes just like in SCSS, and use `$` to reference parent selector.
	 */
	static style: ComponentStyle | null = null

	/** The root element of component. */
	readonly el: HTMLElement

	/**
	 * Caches referenced elements from `:refElement="refName"`.
	 * You should re-define the type as `{[refName]: HTMLElement, ...}` in child component.
	 */
	readonly refElements: Record<string, Element> = {}

	/**
	 * Caches referenced elements from `:refComponent="refName"`.
	 * You should re-define the type as `{[refName]: Component, ...}` in child component.
	 */
	readonly refComponents: Record<string, Component> = {}

	/**
	 * Caches slot elements from `:slot="slotName"`.
	 * You should re-define the type as `{[slotName]: HTMLElement[], ...}` in child component.
	 */
	readonly slots: Record<string, Element[]> = {}

	/** 
	 * Marks the start child nodes as a range,
	 * use for `<slot />` tags to indicate the rest nodes,
	 * which doesn't include more appended nodes.
	 */
	readonly __restNodeRange: ContainerRange

	/* Whether current component was connected into a document. */
	protected __connected: boolean = false

	/** Whether current component in ready state. */
	protected __ready: boolean = false

	/** Template Part instance to patch new render result. */
	protected __rootPart: NodePart | null = null

	/** `WatcherGroup` instance to cache watchers that binded with current component as their context. */
	protected __watcherGroup: WatcherGroup | null = null

	constructor(el: HTMLElement) {
		super()

		this.el = el
		this.__restNodeRange = new ContainerRange(el)

		return observeComponentTarget(this)
	}

	/** Called after component created and properties assigned. */
	__emitCreated(this: Component) {
		// Not be called from constructor function because properties of child classes are not prepared yet.

		this.onCreated()
		this.emit('created')
	}

	/** Called after be connected each time, also after `__emitCreated`. */
	__emitConnected(this: Component, isFirstTimeConnected: boolean) {
		if (!isFirstTimeConnected) {
			if (this.__watcherGroup) {
				this.__watcherGroup.connect()
			}
		}

		this.__connected = true

		// Why `update` but not `__updateImmediately`?
		// On component connected handlers, may delete a child element,
		// and the deleted element may be `el` of another components.
		// In this scenorio `update` later will keep the deleted component not been updated.
		this.update()

		this.onConnected()
		this.emit('connected')
		
		onComponentConnected(this)
	}

	/** Called after be disconnected each time. */
	__emitDisconnected(this: Component) {
		clearDependenciesOf(this)

		if (this.__watcherGroup) {
			this.__watcherGroup.disconnect()
		}

		this.__connected = false

		this.onDisconnected()
		this.emit('disconnected')

		onComponentDisconnected(this)
	}
	
	/** 
	 * Called from a global queuing stack to do updating.
	 * Set `force` to `true` to force updating even not in a document (likes a document fragment).
	 */
	__updateImmediately(this: Component, force: boolean = false) {

		// No need to update after disconnected, or the watcher will be observed and do meaningless updating.
		if (!(this.__connected || force)) {
			return
		}

		startUpdating(this)

		try {
			let result = this.render()
			endUpdating(this)

			if (this.__rootPart) {
				this.__rootPart.update(result)
			}
			else if (result !== null) {
				this.__rootPart = new NodePart(new NodeAnchor(this.el, NodeAnchorType.Container), this)
				this.__rootPart.update(result)
			}
		}
		catch (err) {
			endUpdating(this)
			console.warn(err)
		}

		if (!this.__ready) {
			this.__ready = true
			this.onReady()
			this.emit('ready')
		}
		
		this.onUpdated()
		this.emit('updated')
	}

	/** 
	 * Defines the results the current component should render.
	 * Child class should overwrite this method, normally returns html`...` or a string.
	 * You can choose to not overwrite `render()` to keep it returns `null`,
	 * when you don't want to render any child nodes.
	 */
	protected render(): TemplateResult | string | DirectiveResult | null {
		return null
	}

	/**
	 * Call this to partially or fully update inner contents asynchronously.
	 * Never overwrite this method before you know what you are doing.
	 */
	update() {
		enqueueUpdatableInOrder(this, this, QueueUpdateOrder.Component)
	}

	/**
	 * Called when component instance was just created and all properties are assigned.
	 * All the child nodes that belongs to parent context but contained in current component are prepared.
	 * But self child nodes, `slots`, `refs`, events are not prepared until `onReady`.
	 * You may change some data or visit parent nodes, or register events when `onCreated`.
	 */
	protected onCreated() {}

	/**
	 * Called after all the data, child nodes are prepared, but child components are not prepared yet.
	 * Later it will keep updating other components, so don't check computed styles on child nodes.
	 * If need so, uses `onRenderComplete` or `untilRenderComplete`.
	 * You may visit or adjust child nodes or register more events when `onReady`.
	 */
	protected onReady() {}

	/** 
	 * Called after every time all the data and child nodes were updated.
	 * Same with `onReady` when the first time calling, child components may not be prepared yet.
	 * Try uses `onRenderComplete` or `untilRenderComplete` APIs to handle it if you need.
	 * You may reset some properties or try to capture some nodes dynamically here,
	 * but normally you would don't need to.
	 */
	protected onUpdated() {}

	/** 
	 * Called after component's element was inserted into document.
	 * This will be called each time you inserting the element into document.
	 * If you need to register global listeners like `resize` when element in document,
	 * You should register them here.
	 */
	protected onConnected() {}

	/**
	 * Called after component's element was removed from document.
	 * This will be called for each time you removing the element from document.
	 * If you need to register global listeners like `resize` when element in document,
	 * You should unregister them here.
	 */
	protected onDisconnected() {}

	/** Returns a promise which will be resolved after the component is ready. */
	protected async untilReady(this: Component) {
		if (this.__ready) {
			return
		}
		else {
			return new Promise(resolve => {
				this.once('ready', resolve)
			}) as Promise<void>
		}
	}

	/** 
	 * Watches returned value of `fn`, calls `callback` after this value changed.
	 * Will set callback context as current component.
	 */
	watch<T>(fn: () => T, callback: (newValue: T, oldValue: T | undefined) => void): () => void {
		return this.__getWatcherGroup().watch(fn, callback.bind(this))
	}

	/** 
	 * Watches returned value of `fn`, calls `callback` after this value changed.
	 * Will call `callback` immediately, and also every time value changed.
	 * Will set callback context as current component.
	 */
	watchImmediately<T>(fn: () => T, callback: (newValue: T, oldValue: T | undefined) => void): () => void {
		return this.__getWatcherGroup().watchImmediately(fn, callback.bind(this))
	}

	/** 
	 * Watchs returned value of `fn`, calls `callback` after this value changed.
	 * Calls `callback` for only once.
	 * Will set callback scope as current component.
	 */
	watchOnce<T>(fn: () => T, callback: (newValue: T, oldValue: T | undefined) => void): () => void {
		return this.__getWatcherGroup().watchOnce(fn, callback.bind(this))
	}

	/** 
	 * Watchs returned value of `fn` and calls `callback` after this value becomes true-like.
	 * Will set callback scope as current component.
	 */
	watchUntil<T>(fn: () => T, callback: (trueValue: T) => void): () => void {
		return this.__getWatcherGroup().watchUntil(fn, callback.bind(this))
	}

	/** Ensure `__watcherGroup` to be initialized. */
	__getWatcherGroup(): WatcherGroup {
		if (!this.__watcherGroup) {
			this.__watcherGroup = new WatcherGroup(this)
		}

		return this.__watcherGroup
	}

	/** Update all watchers binded with current component. */
	__updateWatcherGroup() {

		// Why doesn't update watcher group just in `com.__updateImmediately()`:
		// Component collect dependencies and trigger updating when required,
		// while watcher group do the similar things and runs indenpent.
		// They should not affect each other.

		if (this.__watcherGroup) {
			this.__watcherGroup.update()
		}
	}

	/** 
	 * Returns scoped class name scoped with current component's name,
	 * like `.name -> .name__com-name`.
	 */
	scopeClassName(className: string): string {
		let startsWithDot = className[0] === '.'
		let classNameWithoutDot = startsWithDot ? className.slice(1) : className
		let scopedClassNameSet = getScopedClassNames(this.el.localName)

		if (scopedClassNameSet && scopedClassNameSet.has(classNameWithoutDot)) {
			return className + '__' + this.el.localName
		}
		else {
			return className
		}
	}
}
