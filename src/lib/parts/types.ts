export enum PartType {
	Root,
	Child,
	Attr,
	MayAttr,
	Property,
	Bind,
	Event
}

export interface Part {
	type: PartType
	width: number
	strings: string[] | null
	update(value: unknown): void
}
