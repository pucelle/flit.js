import {Emitter} from './emitter'
import {Template, text} from './template'
import {RootPart} from "./parts/root";


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
export function get(el: HTMLElement): Component | undefined {
	return elementComponentMap.get(el)
}


export abstract class Component<Events = any> extends Emitter<Events> {

	el: HTMLElement
	private _node: RootPart | null = null
	private _updated: boolean = false

	constructor(el: HTMLElement, options?: object) {
		super()
		this.el = el
		elementComponentMap.set(el, this)
		Object.assign(this, options)
	}

	abstract render(): string | Template

	update() {
		let result = this.render()
		if (!(result instanceof Template)) {
			result = text([String(result)], [])
		}

		if (this._node) {
			this._node.merge(result)
		}
		else {
			this._node = new RootPart(this.el, result, this)
		}

		this._updated = true
	}
}