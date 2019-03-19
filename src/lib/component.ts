import {Emitter} from './emitter'
import {Template} from './template'
import {RootPart} from './part'


export type ComponentConstructor = {
    new(...args: any[]): Component
}


const componentMap: Map<string, ComponentConstructor> = new Map()

export function defineComponent(name: string, Com: ComponentConstructor) {
	componentMap.set(name, Com)
}

export function getComponentConstructor(name: string): ComponentConstructor | undefined {
	return componentMap.get(name)
}


export abstract class Component<Events = any> extends Emitter<Events> {

	el: HTMLElement
	private _node: RootPart | null = null
	private _updated: boolean = false

	constructor(el: HTMLElement, options?: object) {
		super()
		this.el = el
		Object.assign(this, options)
	}

	abstract render(): string | Template

	update() {
		let result = this.render()
		if (!(result instanceof Template)) {
			result = result === null || result === undefined ? '' : String(result)
			result = new Template('text', [result], [])
		}

		if (this._node) {
			this._node.merge(result)
		}
		else {
			this._node = new RootPart(result, this, this.el)
		}

		this._updated = true
	}
}