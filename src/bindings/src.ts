import {Binding, defineBinding} from './define'


const SrcLoadedURLs: Set<string> = new Set()


/**
 * `:src="${URL}"`
 * When reusing an image and reset it's src, it will keep old image until the new one loaded,
 * Which always confuse us.
 */
defineBinding('src', class SrcBinding implements Binding<[string]> {

	private el: HTMLImageElement

	/** Current resource location. */
	private src: string = ''

	constructor(el: Element) {
		this.el = el as HTMLImageElement
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
})
