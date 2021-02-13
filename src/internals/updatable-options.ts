/** Used to mange updatable options and can also quickly assign default values. */
export class UpdatableOptions<O = any> {

	private readonly defaultOptions: O
	
	private updated: boolean = false
	private options: O | null = null

	constructor(defaultOptions: O) {
		this.defaultOptions = defaultOptions
	}

	/** Whether not been updated. */
	isNotUpdated() {
		return !this.updated
	}

	/** Update options, assign `options` to current option object. */
	update(options: O | undefined) {
		this.options = options || null
		this.updated = true
	}

	/** 
	 * Get specified option value from it's key.
	 * May get a default value if not set.
	 */
	get<K extends keyof O>(key: K): Required<O>[K] {
		if (this.options) {
			let value = this.options[key]
			return value === undefined ? this.defaultOptions[key] : value
		}
		else {
			return this.defaultOptions[key]
		}
	}

	/** 
	 * Check if have set specified option value from it's key.
	 * Ignores default values.
	 */
	has<K extends keyof O>(key: K): boolean {
		if (this.options) {
			return this.options[key] !== undefined
		}
		else {
			return false
		}
	}

	/** Get all options. */
	getOptions() {
		return this.options || this.defaultOptions
	}
}