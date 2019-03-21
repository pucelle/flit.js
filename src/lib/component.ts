import {Emitter} from './emitter'
import {TemplateResult} from './template-result'
import {RootPart} from "./parts"


/**
 * The constructor type of component class.
 */
export type ComponentConstructor = {
    new(el: HTMLElement, options?: object): Component
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
export function getComponentConstructor(name: string): ComponentConstructor | undefined {
	return componentMap.get(name)
}


const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()

/**
 * Get component instance from root element.
 * @param el The element to get component instance at.
 */
export function getComponentAt(el: HTMLElement): Component | undefined {
	return elementComponentMap.get(el)
}

/**
 * Get component instance from root element asynchronously.
 * @param el The element to get component instance at.
 */
export function getComponentAtAsync(el: HTMLElement): Promise<Component | undefined> {
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


const componentCreatedMap: WeakMap<HTMLElement, ((com: Component) => void)[]> = new WeakMap()

/**
 * Call callback after component instance created.
 * @param el The element which will create instance at.
 */
export function onComponentCreatedAt(el: HTMLElement, callback: (com: Component) => void) {
	let callbacks = componentCreatedMap.get(el)
	if (!callbacks) {
		componentCreatedMap.set(el, (callbacks = []))
	}
	callbacks.push(callback)
}

function emitComponentCreated(el: HTMLElement, com: Component) {
	let callbacks = componentCreatedMap.get(el)
	if (callbacks) {
		for (let callback of callbacks) {
			callback(com)
		}
		componentCreatedMap.delete(el)
	}
}


/**
 * The abstract component class, you can instantiate it from just create an element, or call `render()` if you want to config it.
 */
export abstract class Component<Events = any> extends Emitter<Events> {

	el: HTMLElement
	refs: {[key: string]: Element} = {}
	private _node: RootPart | null = null

	constructor(el: HTMLElement) {
		super()

		this.el = el
		elementComponentMap.set(el, this)

		//may assign properties from `:props`, or bind component events from `@com-event`
		emitComponentCreated(el, this)
		
		//TODO
		Promise.resolve().then(() => {
			this.update()
		})
	}

	/**
	 * Child class should implement this method, normally returns html`...` or string.
	 */
	abstract render(): string | TemplateResult

	/**
	 * Call this to partially or fully update if needed.
	 * You should not overwrite this method until you know what you are doing.
	 */
	protected update() {
		let value = this.render()

		if (this._node) {
			this._node.update(value)
		}
		else {
			this._node = new RootPart(this.el, value, this)
		}
	}

	/**
	 * Called when root element inserted into document.
	 */
	onConnected() {}

	/**
	 * Called when root element removed from document.
	 * If you registered global listeners, don't forget to remove it here.
	 */
	onDisconnected() {}
}