import {Binding, defineBinding} from './define'


const SrcLoadedURLs: Set<string> = new Set()


/**
 * `:src="${URL}"`
 * When reusing an image and reset it's src, it will keep old image until the new one loaded,
 * Which always confuse us.
 */
defineBinding('src', class SrcBinding implements Binding<[string]> {

	private el: HTMLImageElement

	constructor(el: Element) {
		this.el = el as HTMLImageElement
	}

	update(value: string) {
		if (SrcLoadedURLs.has(value)) {
			this.el.src = value
		}
		else {
			this.el.src = ''

			let img = new Image()

			img.onload = () => {
				SrcLoadedURLs.add(value)
				this.el.src = value
			}

			img.src = value
		}
	}

	remove() {
		this.el.src = ''
	}
})
