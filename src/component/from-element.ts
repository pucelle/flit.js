import {Component} from './component'
import {onComponentCreatedAt} from './life-cycle'
import {ComponentConstructor} from './constructor'


/** To cache `el -> com` map */
const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()

/**
 * Set component instance at root element.
 */
export function setComponentAtElement(el: HTMLElement, com: Component) {
	elementComponentMap.set(el, com)
}

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


/**
 * Get closest ancestor component which instanceof `Com`.
 * It's very common that you extend a component and define a new custom element,
 * So you will can't find the parent component from the tag name.
 * Bu you can also search super class by this method.
 * @param el The element to search from it and it's ancestors for component instance.
 * @param Com The component constructor to search.
 */
export function getClosestComponent<C extends ComponentConstructor>(el: Element, Com: C): InstanceType<C> | null {
	let parent: Element | null = el

	while (parent && parent instanceof HTMLElement) {
		if (parent.localName.includes('-')) {
			let com = getComponent(parent) as Component
			if (com instanceof Com) {
				return com as InstanceType<C>
			}
		}
		
		parent = parent.parentElement
	}

	return null
}