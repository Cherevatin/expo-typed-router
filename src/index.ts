import * as ExpoRouter from 'expo-router'
import { createElement, useMemo, type ComponentProps, type ReactElement } from 'react'
import { buildRoutes, decode, encode, type Destination, type RouteBuilders, type RouteConfig, type RouteParams } from './routes'

export * from 'expo-router'
export { param, type Param, type RawParam } from './params'
export type { Destination, RouteBuilders, RouteConfig, RouteParams, SchemaParams } from './routes'

type Router = ReturnType<typeof ExpoRouter.useRouter>
type Method = 'push' | 'replace' | 'navigate' | 'dismissTo' | 'prefetch'
type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never
export type Target<C extends RouteConfig> = Destination<C> | ((routes: RouteBuilders<C>) => Destination<C>)
export type TypedRouter<C extends RouteConfig> = Omit<Router, Method | 'setParams'> & {
  [M in Method]: (target: Target<C>, ...options: Tail<Parameters<Router[M]>>) => ReturnType<Router[M]>
} & {
  setParams<K extends keyof C>(route: K, params: Partial<RouteParams<C, K>>): void
}
export type TypedLinkProps<C extends RouteConfig> = Omit<ComponentProps<typeof ExpoRouter.Link>, 'href'> & { href: Target<C> }
export type TypedRedirectProps<C extends RouteConfig> = Omit<ComponentProps<typeof ExpoRouter.Redirect>, 'href'> & { href: Target<C> }

export type TypedNavigation<C extends RouteConfig> = Omit<typeof ExpoRouter,
  'router' | 'Link' | 'Redirect' | 'useRouter' | 'useLocalSearchParams' | 'useGlobalSearchParams'> & {
  routes: RouteBuilders<C>
  router: TypedRouter<C>
  Link: ((props: TypedLinkProps<C>) => ReturnType<typeof ExpoRouter.Link>) &
    Omit<typeof ExpoRouter.Link, 'resolveHref'> & { resolveHref(target: Target<C>): string }
  Redirect: (props: TypedRedirectProps<C>) => ReactElement
  useRouter(): TypedRouter<C>
  useLocalSearchParams<K extends keyof C>(key: K): RouteParams<C, K>
  useGlobalSearchParams<K extends keyof C>(key: K): RouteParams<C, K>
}

export function createTypedRouter<const C extends RouteConfig>(config: C): TypedNavigation<C> {
  const routes = buildRoutes(config)
  const resolve = (target: Target<C>): ExpoRouter.Href =>
    (typeof target === 'function' ? target(routes) : target) as unknown as ExpoRouter.Href

  function wrapRouter(router: Router): TypedRouter<C> {
    const result = { ...router } as unknown as TypedRouter<C>
    for (const method of ['push', 'replace', 'navigate', 'dismissTo', 'prefetch'] as const) {
      Object.assign(result, {
        [method]: (target: Target<C>, ...options: unknown[]) =>
          (router[method] as (href: ExpoRouter.Href, ...args: unknown[]) => void)(resolve(target), ...options),
      })
    }
    result.setParams = (key, values) => {
      const schema = config[key].params ?? {}
      const encoded: Record<string, string | string[] | undefined> = encode(schema, values, true)
      for (const key of Object.keys(values)) {
        if (values[key] === undefined) encoded[key] = undefined
      }
      router.setParams(encoded)
    }
    return result
  }

  const Link = Object.assign(function Link(props: TypedLinkProps<C>) {
    return createElement(ExpoRouter.Link, { ...props, href: resolve(props.href) })
  }, ExpoRouter.Link as Omit<typeof ExpoRouter.Link, 'resolveHref'>, {
    resolveHref: (target: Target<C>) => ExpoRouter.Link.resolveHref(resolve(target)),
  })

  function Redirect(props: TypedRedirectProps<C>) {
    return createElement(ExpoRouter.Redirect, { ...props, href: resolve(props.href) })
  }

  function useRouter(): TypedRouter<C> {
    const router = ExpoRouter.useRouter()
    return useMemo(() => wrapRouter(router), [router])
  }

  function useLocalSearchParams<K extends keyof C>(key: K): RouteParams<C, K> {
    const values = ExpoRouter.useLocalSearchParams()
    return useMemo(() => decode(config[key].params ?? {}, values) as RouteParams<C, K>, [key, values])
  }

  function useGlobalSearchParams<K extends keyof C>(key: K): RouteParams<C, K> {
    const values = ExpoRouter.useGlobalSearchParams()
    return useMemo(() => decode(config[key].params ?? {}, values) as RouteParams<C, K>, [key, values])
  }

  return { ...ExpoRouter, routes, router: wrapRouter(ExpoRouter.router), Link, Redirect, useRouter, useLocalSearchParams, useGlobalSearchParams }
}
