import {ComponentConstructor, defineComponent, getComponentAtElement} from './component'
import {css} from './parts'


const componentStyleAppendedSet: Set<ComponentConstructor> = new Set()


/**
 * Defines a component with specified name.
 * Defines a custom element, but just used to start the defined component
 * @param name The component name.
 * @param Component The Component class definition.
 */
export function define(name: string, Com: ComponentConstructor) {
	if (!name.includes('-')) {
		throw new Error(`"${name}" can't be defined as custom element, it must contain "-"`)
	}

	customElements.define(name, class CustomLitElement extends HTMLElement {
		// A potential problem here:
		// When `connectedCallback` been called, the child nodes of it is not linked yet.
		connectedCallback() {
			let com = getComponentAtElement(this)
			if (!com) {
				if (Com.style && !componentStyleAppendedSet.has(Com)) {
					let style = Com.style
					if (typeof style === 'string') {
						style = css`${style}`
					}
					let styleTag = document.createElement('style')
					styleTag.type = 'text/css'
					styleTag.textContent = style.join()
					document.head.append(styleTag)
					
					componentStyleAppendedSet.add(Com)
				}

				com = new Com(this)
				com.__emitFirstConnected()
			}
			com.__emitConnected()
		}

		disconnectedCallback() {
			let com = getComponentAtElement(this)
			if (com) {
				com.__emitDisconnected()
			}
		}
	})

	defineComponent(name, Com)
}
