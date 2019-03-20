import {Emitter} from './emitter'
import {Template, text} from './template'
import {RootPart} from "./parts"


export type ComponentConstructor = {
    new(el: HTMLElement, options?: object): Component
}


const componentMap: Map<string, ComponentConstructor> = new Map()

export function defineComponent(name: string, Com: ComponentConstructor) {
	componentMap.set(name, Com)
}

export function getComponentConstructor(name: string): ComponentConstructor | undefined {
	return componentMap.get(name)
}


const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()

/**
 * Get component instance from root element.
 * @param el The element.
 */
export function getComponentAt(el: HTMLElement): Component | undefined {
	return elementComponentMap.get(el)
}


const componentCreatedMap: WeakMap<HTMLElement, ((com: Component) => void)[]> = new WeakMap()

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


export abstract class Component<Events = any> extends Emitter<Events> {

	el: HTMLElement
	private _node: RootPart | null = null

	constructor(el: HTMLElement, options?: object) {
		super()

		this.el = el
		Object.assign(this, options)
		
		elementComponentMap.set(el, this)
		emitComponentCreated(el, this)
	}

	abstract render(): string | Template

	protected update() {
		let result = this.render()
		if (!(result instanceof Template)) {
			result = text([String(result)], [])
		}

		if (this._node) {
			this._node.update(result)
		}
		else {
			this._node = new RootPart(this.el, result, this)
		}
	}

	onConnected() {}

	onDisconnected() {}
}