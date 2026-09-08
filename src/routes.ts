import type { Param, RawParam } from './params'

export type ParamSchema = Record<string, Param<any>>
export type RouteConfig = Record<string, { path: `/${string}`; params?: ParamSchema }>
type Value<P> = P extends Param<infer T> ? T : never
export type SchemaParams<S extends ParamSchema> = {
  [K in keyof S as undefined extends Value<S[K]> ? never : K]: Value<S[K]>
} & {
  [K in keyof S as undefined extends Value<S[K]> ? K : never]?: Value<S[K]>
}
export type RouteParams<C extends RouteConfig, K extends keyof C> =
  C[K] extends { params: infer S extends ParamSchema } ? SchemaParams<S> : Record<string, never>

declare const destination: unique symbol
export type Destination<C extends RouteConfig> = {
  readonly pathname: string
  readonly params: Record<string, string | string[]>
  readonly [destination]: C
}
type Args<P> = {} extends P ? [params?: P] : [params: P]
export type RouteBuilders<C extends RouteConfig> = {
  [K in keyof C]: (...args: Args<RouteParams<C, K>>) => Destination<C>
}

export function encode(schema: ParamSchema, values: Record<string, unknown>, partial = false) {
  for (const key of Object.keys(values)) {
    if (!Object.hasOwnProperty.call(schema, key)) throw new TypeError(`Unknown parameter: ${key}`)
  }
  const result: Record<string, string | string[]> = {}
  for (const [key, descriptor] of Object.entries(schema)) {
    if (partial && !Object.hasOwnProperty.call(values, key)) continue
    const value = values[key]
    if (value === undefined && !descriptor.optional) throw new TypeError(`Missing parameter: ${key}`)
    const encoded = descriptor.serialize(value)
    if (encoded !== undefined) result[key] = encoded
  }
  return result
}

export function decode(schema: ParamSchema, values: Record<string, RawParam>) {
  const result: Record<string, unknown> = {}
  for (const [key, descriptor] of Object.entries(schema)) {
    const value = descriptor.parse(values[key])
    if (value !== undefined) result[key] = value
  }
  return result
}

export function buildRoutes<C extends RouteConfig>(config: C): RouteBuilders<C> {
  const builders: Record<string, unknown> = Object.create(null)
  for (const [name, route] of Object.entries(config)) {
    if (!route.path.startsWith('/') || /[?#]/.test(route.path)) {
      throw new TypeError(`Route ${name} must have an absolute pathname without a query or hash`)
    }
    for (const match of route.path.matchAll(/\[(?:\.\.\.)?([^\]]+)\]/g)) {
      const descriptor = route.params?.[match[1]]
      if (!descriptor || descriptor.optional) throw new TypeError(`Route ${name} requires parameter ${match[1]}`)
    }
    builders[name] = (values: Record<string, unknown> = {}) => ({
      pathname: route.path,
      params: encode(route.params ?? {}, values),
    })
  }
  return builders as RouteBuilders<C>
}
