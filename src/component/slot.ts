import {Component} from './component'
import {NodeRange} from '../libs/node-helper'


export class SlotProcesser {

	private com: Component
	private slots: {[key: string]: HTMLElement[]} = {}
	private restSlotNodeRange: NodeRange | null = null

	// When updated inner templates and found there are slots need to be filled, This value will become `true`.
	// Why not just move slots into template fragment?
	//   1. It will trigger `connectedCallback` when append into fragment.
	//   2. To handle all `<slot>` elements in one query would be better.
	private hasSlotsToBeFilled: boolean = false

	constructor(com: Component) {
		this.com = com
		this.initNamedSlotNodes()
		this.initRestSlotRange()
	}

	// Must cache slot nodes when com created and before child created,
	// Because child components may remove them when created, in this situation we will lost it forever.
	private initNamedSlotNodes() {
		let slots = this.slots

		// We only check `[slot]` in the children, or:
		// <com1><com2><el slot="for com2"></com2></com1>
		// it will cause `slot` for `com2` was captured by `com1`.
		for (let el of [...this.com.el.children]) {
			let slotName = el.getAttribute('slot')!
			if (slotName) {
				let els = slots[slotName]
				if (!els) {
					els = slots[slotName] = []
				}
				els.push(el as HTMLElement)

				// No need to remove `slot` attribute here, bacause we only check child slot elements, not check deeper.
				// So it can avoid been treated as slot element again after moved into an outer component
				el.remove()
			}
		}
	}

	// It's very import to cache rest nodes after child created and before rendering,
	// because these nodes may be changed since child nodes may be removed when child components created.
	// Otherwise those nodes may be firstly removed and then restored from `<slot />`, so we must cache before rendering.
	private initRestSlotRange() {
		let fragment = document.createDocumentFragment()
		fragment.append(...this.com.el.childNodes)
		this.restSlotNodeRange = new NodeRange(fragment)
	}

	needToFillSlotsLater() {
		this.hasSlotsToBeFilled = true
	}

	mayFillSlots() {
		if (!this.hasSlotsToBeFilled) {
			return
		}

		let slots = this.slots
		let slotAnchors = this.com.el.querySelectorAll('slot')

		for (let slotAnchor of slotAnchors) {
			let name = slotAnchor.getAttribute('name')
			if (name) {
				if (slots && slots[name]) {
					while (slotAnchor.firstChild) {
						slotAnchor.firstChild.remove()
					}
					slotAnchor.append(...slots[name]!)
				}
			}
			else if (this.restSlotNodeRange) {
				while (slotAnchor.firstChild) {
					slotAnchor.firstChild.remove()
				}
				slotAnchor.append(this.restSlotNodeRange.getFragment())
			}
		}
		
		this.hasSlotsToBeFilled = false
	}
}
