import {ComponentConstructor, defineComponent, getComponentAtElement} from './component'
import {TemplateResult} from './parts'


const componentStyleSet: Map<ComponentConstructor, [string, HTMLStyleElement]> = new Map()


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
				if (Com.style && !componentStyleSet.has(Com)) {
					let styleTag = document.createElement('style')
					styleTag.textContent = scopeStyle(getStyleContent(Com), name)
					document.head.append(styleTag)
					componentStyleSet.set(Com, [name, styleTag])
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


function getStyleContent(Com: ComponentConstructor): string {
	let style = Com.style

	if (typeof style === 'function') {
		style = style()
	}

	if (style instanceof TemplateResult) {
		style = style.join()
	}

	return style!
}


// Benchmark: https://jsperf.com/is-nesting-selector-slower
// About 2~4% slower for each nested selector when rendering.
function scopeStyle(style: string, comName: string) {
	let re = /[^;}]+\{/g

	return style.replace(re, (m0: string) => {
		return m0.replace(/\$(\w+)/g, '$1__' + comName)
				 .replace(/(?:^|,)\s*\w+/g, (m0: string) => {
					return m0.replace(/\w+/, comName + ' $&')
				 })
	})
}


/** Update all styles for components, e.g., update styles after theme changed. */
export function updateAllStyles() {
	for (let [Com, [name, styleTag]] of componentStyleSet) {
		if (typeof Com.style === 'function') {
			let newContent = scopeStyle(getStyleContent(Com), name)
			if (newContent !== styleTag.textContent) {
				styleTag.textContent = newContent
			}
		}
	}
}