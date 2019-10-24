/** Each part to manage one `${...}` expression, which may be a template, templates, attribute... */
export interface Part {
	update(value: unknown): void
	remove(): void
}
