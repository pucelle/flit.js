import {binaryFindIndex} from '../../helpers/utils'


export function locateFirstVisibleIndex(container: Element, els: ArrayLike<Element>): number {
	return locateVisibleIndex(container, els, true)
}

export function locateLastVisibleIndex(container: Element, els: ArrayLike<Element>): number {
	return locateVisibleIndex(container, els, false)
}

function locateVisibleIndex(container: Element, els: ArrayLike<Element>, isFirst: boolean): number {
	let containerRect = container.getBoundingClientRect()

	return binaryFindIndex(els, (el) => {
		let rect = el.getBoundingClientRect()
		if (rect.bottom <= containerRect.top) {
			return 1
		}
		else if (rect.top >= containerRect.bottom) {
			return -1
		}
		else {
			return isFirst ? -1 : 1
		}
	})
}
