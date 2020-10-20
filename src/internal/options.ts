
/** Used to mange options updating. */
export class Options<O = any> {

	default: O
	options: O | null = null
	updated: boolean = false

	constructor(defaultOptions: O) {
		this.default = defaultOptions
	}

	update(options: O | undefined) {
		this.options = options || null
		this.updated = true
	}

	get<K extends keyof O>(key: K): Required<O>[K] {
		if (this.options) {
			let value = this.options[key]
			return value === undefined ? this.default[key] : value
		}
		else {
			return this.default[key]
		}
	}
}