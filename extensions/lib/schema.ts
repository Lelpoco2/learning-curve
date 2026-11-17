/**
 * Minimal typed JSON Schema builder (no dependencies), API-compatible with the TypeBox subset the
 * tools use. Schemas are plain JSON Schema objects, accepted by pi (any JSON Schema) and by MCP
 * clients (Claude Code). `Static<typeof S>` gives the TypeScript type of the validated value.
 */

declare const TYPE: unique symbol;
/** Runtime marker for optional properties (a symbol: never serialized to JSON). */
const OPTIONAL = Symbol.for("learning-curve.optional");

export type TSchema<T = unknown> = { readonly [TYPE]?: T } & { [key: string]: unknown };
type Optional = { readonly [OPTIONAL]: true };
export type Static<S> = S extends TSchema<infer T> ? T : never;

type Opts = Record<string, unknown>;
type RequiredKeys<P> = { [K in keyof P]: P[K] extends Optional ? never : K }[keyof P];
type OptionalKeys<P> = { [K in keyof P]: P[K] extends Optional ? K : never }[keyof P];
type ObjectType<P extends Record<string, TSchema>> = { [K in RequiredKeys<P>]: Static<P[K]> } & { [K in OptionalKeys<P>]?: Static<P[K]> } extends infer O
	? { [K in keyof O]: O[K] }
	: never;

function isOptional(s: unknown): boolean {
	return typeof s === "object" && s !== null && (s as Record<symbol, unknown>)[OPTIONAL] === true;
}

export const Type = {
	String: (opts: Opts = {}): TSchema<string> => ({ type: "string", ...opts }),
	Integer: (opts: Opts = {}): TSchema<number> => ({ type: "integer", ...opts }),
	Number: (opts: Opts = {}): TSchema<number> => ({ type: "number", ...opts }),
	Boolean: (opts: Opts = {}): TSchema<boolean> => ({ type: "boolean", ...opts }),
	Array: <S extends TSchema>(items: S, opts: Opts = {}): TSchema<Static<S>[]> => ({ type: "array", items, ...opts }),
	Object: <P extends Record<string, TSchema>>(properties: P, opts: Opts = {}): TSchema<ObjectType<P>> => {
		const required = Object.keys(properties).filter((k) => !isOptional(properties[k]));
		return { type: "object", properties, ...(required.length ? { required } : {}), ...opts };
	},
	Optional: <S extends TSchema>(schema: S): S & Optional => {
		const copy = { ...schema } as S & Optional;
		Object.defineProperty(copy, OPTIONAL, { value: true, enumerable: false });
		return copy;
	},
	/** A schema written by hand, typed as T. */
	Unsafe: <T>(schema: Opts): TSchema<T> => schema as TSchema<T>,
};

/** Plain `{ type: "string", enum: [...] }` schema (accepted by every provider). */
export function StringEnum<const T extends readonly string[]>(values: T, options: { description?: string } = {}): TSchema<T[number]> {
	return Type.Unsafe<T[number]>({ type: "string", enum: [...values], ...options });
}

/** The schema as plain JSON (what is sent to MCP clients). */
export function toJsonSchema(schema: TSchema): Record<string, unknown> {
	return JSON.parse(JSON.stringify(schema));
}
