import {Emitter} from '../internal/emitter'
import {NodePart, TemplateResult} from '../template'
import {enqueueComponentToUpdate} from '../queue'
import {startUpdating, endUpdating, observeComTarget, clearDependencies, clearAsDependency, restoreAsDependency} from '../observer'
import {WatcherGroup, Watcher} from '../watcher'
import {getScopedClassNameSet, ComponentStyle} from './style'
import {NodeAnchorType, NodeAnchor} from '../internal/node-helper'
import {DirectiveResult} from '../directives'
import {setComponentAtElement} from './from-element'
import {emitComponentCreatedCallbacks, onComponentConnected, onComponentDisconnected} from './life-cycle'
import {SlotProcesser} from './slot'


/** Context may be `null` when using `render` or `renderAndUpdate` */
export type Context = Component | null

export interface ComponentEvents {
	/** 
	 * No need to register `created` event, you may just get component and do something.
	 * Seems that the only usage of it is to handle something after all sequential `onCreated` called.
	 */
	// created: () => void

	/** Not useful, equals to get component and await render complete. */
	// ready: () => void

	/** 
	 * After data updated, and will reander in next tick.
	 * Not useful because in component we can use `onUpdated` instead,
	 * in outer other classes should only operate data and element of current component.
	 */
	// updated: () => void

	/**
	 * After data rendered, you can visit element layouts now.
	 * We dropped the support of it because it equals running `onRenderComplete` or `renderComplete` in `updated`.
	 */ 
	// rendered: () => void

	/** After element been inserted into body, include the first time. */
	connected: () => void

	/** After element been removed from body, include the first time. */
	disconnected: () => void
}


/** 
 * Super class of all the components, create automacially from custom elements connected into document.
 * @typeparam E Event interface in `{eventName: (...args) => void}` format.
 */
export abstract class Component<E = any> extends Emitter<E & ComponentEvents> {

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

	/** The root element of component. */
	el: HTMLElement

	/**
	 * The reference map object of element inside.
	 * You can specify `:ref="refName"` on an element,
	 * or using `:ref=${this.onRef}` to call `this.onRef(refElement)` every time when the reference element updated.
	 */

	// Should be `Element` type, but in 99% scenarios it's HTMLElement.
	refs: {[key: string]: HTMLElement} = {}
	slots: {[key: string]: HTMLElement[]} = {}

	private __slotProcesser: SlotProcesser | null = null
	private __rootPart: NodePart | null = null
	private __updated: boolean = false
	private __watcherGroup: WatcherGroup | null = null
	private __connected: boolean = false
	private __connectedBefore: boolean = false
	private __mustUpdate: boolean = true

	constructor(el: HTMLElement) {
		super()
		this.el = el
		return observeComTarget(this as any)
	}

	/** Not called in constructor because in child classes it doesn't apply instance properties yet. */
	/** @hidden */
	__emitCreated() {
		setComponentAtElement(this.el, this)
		emitComponentCreatedCallbacks(this.el, this)
		this.onCreated()

		// A typescript issue here if we want to infer emitter arguments:
		// We accept an `Events` and union it with type `ComponentEvents`,
		// the returned type for `rendered` property will become `Events['rendered'] & () => void`,
		// `Parmaters<...>` of it will return the arguments of `Events['rendered']`.
		// So here show the issue that passed arguments `[]` can't be assigned to it.

		// This can't be fixed right now since we can't implement a type function like `interface overwritting`
		// But finally this was resolved by a newly defined type `ExtendEvents` in `emitter.ts`.
		
		// this.emit('created')
	}

	/** @hidden */
	__emitConnected() {
		// Not do following things when firstly connected.
		if (this.__connectedBefore) {
			// Must restore before updating, because the restored result may be changed when updating.
			restoreAsDependency(this)

			if (this.__watcherGroup) {
				this.__watcherGroup.connect()
			}
		}
		else {
			this.__connectedBefore = true
		}

		this.__connected = true

		// Sometimes we may pre render but not connect component,
		// In this condition watchers of component are active and they keep notify component to update.
		// When connect the component, may no need to update.

		// Why `update` here but not `__updateImmediately`?
		// After component created, it may delete element belongs to other components in `onCreated`
		// Then in following micro task, the deleted components's `__connected` becomes false,
		// and they will not been updated finally as expected.
		if (this.__mustUpdate) {
			this.update()
		}

		this.onConnected()
		this.emit('connected')
		onComponentConnected(this)
	}

	/** @hidden */
	__emitDisconnected() {
		clearDependencies(this)
		clearAsDependency(this)

		if (this.__watcherGroup) {
			this.__watcherGroup.disconnect()
		}

		this.__connected = false
		this.__mustUpdate = true
		this.onDisconnected()
		this.emit('disconnected')
		onComponentDisconnected(this)
	}

	/** May be called in rendering, so we can avoid checking slot elements when no slot rendered. */
	/** @hidden */
	__foundSlotsWhenRendering() {
		// One potential issue here:
		// created -> child component created.
		//         -> element of child component removed, which also used as slot element of current component.
		//         -> render and initialize slots for current component.
		//         -> Can't found slot element because it was removed.
		if (!this.__slotProcesser && this.el.childNodes.length > 0) {
			this.__slotProcesser = new SlotProcesser(this)
		}

		if (this.__slotProcesser) {
			this.__slotProcesser.needToFillSlotsLater()
		}
	}
	
	/** @hidden */
	__updateImmediately(force: boolean = false) {
		if (!this.__connected && !force) {
			this.__mustUpdate = true
			return
		}

		this.__mustUpdate = false

		startUpdating(this)
		try{
			let result = this.render()
			endUpdating(this)

			if (this.__rootPart) {
				this.__rootPart.update(result)
			}
			else if (result !== null) {
				this.__rootPart = new NodePart(new NodeAnchor(this.el, NodeAnchorType.Root), result, this)
			}
		}
		catch (err) {
			endUpdating(this)
			console.warn(err)
		}

		if (this.__slotProcesser) {
			this.__slotProcesser.mayFillSlots()
		}

		let firstlyUpdate = !this.__updated
		if (firstlyUpdate) {
			this.onReady()
			this.__updated = true
		}
		
		this.onUpdated()
	}

	/** Force to update all watchers binded to current context. */
	/** @hidden */
	__updateWatcherGroup() {
		if (this.__watcherGroup) {
			this.__watcherGroup.update()
		}
	}

	/** 
	 * Child class should implement this method, normally returns html`...` or string.
	 * You can choose to not overwrite `render()` to keep it returns `null` when you don't want to render any child nodes.
	 */
	protected render(): TemplateResult | string | DirectiveResult | null {
		return null
	}

	/**
	 * Call this to partially or fully update asynchronously if needed.
	 * You should not overwrite this method until you know what you are doing.
	 */
	update() {
		enqueueComponentToUpdate(this)
	}

	/**
	 * Called when component instance was just created and all properties assigned.
	 * Original child nodes are prepared, but slots are not prepared right now.
	 * You may changed some data or visit parent nodes or `this.el` and operate them here.
	 */
	protected onCreated() {}

	/**
	 * Called after all the data updated for the first time.
	 * Child nodes are rendered, slots are prepared, but child components are not.
	 * Will keep updating other components, so please don't check computed styles on elements.
	 * You may visit child nodes or bind events here.
	 */
	protected onReady() {}

	/** 
	 * Called after all the data updated.
	 * Will keep updating other components, so please don't check computed style on elements.
	 */
	protected onUpdated() {}

	/** 
	 * Called after all the data updated and elements have rendered.
	 * You can visit elemenet layout properties now.
	 */
	protected onRendered() {}

	/** 
	 * Called when root element was inserted into document.
	 * This will be called for each time you insert the element into document.
	 * If you need to register global listeners like `resize` when element in document, restore them here.
	 */
	protected onConnected() {}

	/**
	 * Called when root element removed from document.
	 * This will be called for each time you removed the element into document.
	 * If you registered global listeners like `resize`, don't forget to unregister them here.
	 */
	protected onDisconnected() {}

	/** 
	 * Watch return value of function and trigger callback with this value as argument after it changed.
	 * Will set callback scope as this.
	 */
	watch<T>(fn: () => T, callback: (value: T) => void): () => void {
		this.__watcherGroup = this.__watcherGroup || new WatcherGroup()
		return this.__watcherGroup!.watch(fn, callback.bind(this))
	}

	/** 
	 * Watch return value of function and trigger callback with this value as argument later and after it changed.
	 * Will set callback scope as this.
	 */
	watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
		this.__watcherGroup = this.__watcherGroup || new WatcherGroup()
		return this.__watcherGroup!.watchImmediately(fn, callback.bind(this))
	}

	/** 
	 * Watch return value of function and trigger callback with this value as argument. Trigger callback for only once.
	 * Will set callback scope as this.
	 */
	watchOnce<T>(fn: () => T, callback: (value: T) => void): () => void {
		this.__watcherGroup = this.__watcherGroup || new WatcherGroup()
		return this.__watcherGroup!.watchOnce(fn, callback.bind(this))
	}

	/** 
	 * Watch return value of function and trigger callback with this value as argument. Trigger callback for only once.
	 * Will set callback scope as this.
	 */
	watchUntil<T>(fn: () => T, callback: () => void): () => void {
		this.__watcherGroup = this.__watcherGroup || new WatcherGroup()
		return this.__watcherGroup!.watchUntil(fn, callback.bind(this))
	}

	/** @hidden */
	__addWatcher(watcher: Watcher) {
		this.__watcherGroup = this.__watcherGroup || new WatcherGroup()
		this.__watcherGroup.add(watcher)
	}

	/** @hidden */
	__deleteWatcher(watcher: Watcher) {
		this.__watcherGroup = this.__watcherGroup || new WatcherGroup()
		this.__watcherGroup.delete(watcher)
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
