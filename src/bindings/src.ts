import {Binding, defineBinding} from './define'


/** Caches global loaded URLs. */
const SrcLoadedURLs: Set<string> = new Set()


/**
 * `:src` binding will update the src property of media element.
 * 
 * `:src=${URL}`
 * 
 * Note after reuse an image and reset it's src, it will keep old image until the new one loaded.
 */
@defineBinding('src')
export class SrcBinding implements Binding<string> {

	private readonly el: HTMLMediaElement

	/** Current resource location. */
	private src: string = ''

	constructor(el: Element) {
		if (el instanceof HTMLMediaElement) {
			throw new Error('":src" binding can only binded with HTMLMediaElement!')
		}
		
		this.el = el as HTMLMediaElement
	}

	update(value: string) {
		this.src = value

		if (SrcLoadedURLs.has(value)) {
			this.el.src = value
		}
		else if (value) {
			this.el.src = ''

			let img = new Image()

			img.onload = () => {
				SrcLoadedURLs.add(value)

				// Must re validate it, or src will be wrongly updated.
				if (value === this.src) {
					this.el.src = value
				}
			}

			img.src = value
		}
		else {
			this.el.src = ''
		}
	}

	remove() {
		this.el.src = ''
	}
}
