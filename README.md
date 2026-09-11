# typed-expo-router

Define your navigation contract once: named routes, paths, required params, optional query params, and URL parsing. Use it through typed router methods, lambda callbacks, `Link`, `Redirect`, and search-parameter hooks.

```tsx
router.push((r) => r.product({ productId: 'sku-42', referral: 'search' }))
router.push((r) => r.search({ query: 'headphones', page: 2, inStock: true }))
```

## Why use this with Expo's typed routes?

Expo Router already provides [typed routes](https://docs.expo.dev/router/reference/typed-routes/): it generates types from route files, checks paths and dynamic segments, and types navigation APIs. Query parameters are not generally represented in the filesystem, so Expo documents manually supplying their types to search hooks.

This library adds an explicit application contract:

- **Lambda autocomplete:** type `router.push((r) => r.` or `<Link href={(r) => r.` to discover named destinations and their params. You don't need to remember a pathname or import `routes` in every component. A path change can be made in the config while call sites keep their route alias.
- **Typed query params when navigating and reading:** declare `page` as a number, `inStock` as a boolean, or `sort` as an enum once. Builders check outgoing values, and hooks infer their return types from that same config.
- **Runtime URL conversion:** `page: 2` and `inStock: true` serialize as URL strings and parse back into a number and boolean. Invalid incoming values throw instead of silently acquiring a TypeScript annotation.
- **Required and optional params:** the config determines whether a builder needs params and which fields callers must provide.

For example, the config below makes `router.push((r) => r.search({ page: 'two' }))` and `router.push((r) => r.search({ sort: 'popular' }))` TypeScript errors. The receiving screen gets `page: number | undefined` without repeating a generic interface.

The tradeoff is maintaining a config alongside your route files. Expo's generated types derive valid paths from those files; this library does not verify that config paths exist. You can keep Expo's `experiments.typedRoutes` enabled, but this wrapper does not require it.

## 1. Install in an existing Expo Router app

This version targets Expo Router 57 and React 19. From your Expo application's directory, run:

```sh
npm install typed-expo-router
```

Keep your app's existing `expo-router/entry` entry point and Expo Router setup. No new provider, Babel plugin, or initialization component is needed. The following walkthrough uses a small shopping app and relative imports, so it doesn't require an import alias.

## 2. Create the route files and a shared navigation module

Use this structure in your application:

```text
src/
  app/
    _layout.tsx
    index.tsx
    search.tsx
    products/
      [productId].tsx
  navigation/
    index.ts
  components/
    ProductCard.tsx
  services/
    openProduct.ts
```

Keep the config outside `src/app`, which is reserved for Expo route files. Initialize it once at module scope in **`src/navigation/index.ts`**:

```ts
import { createTypedRouter, param } from 'typed-expo-router'

export const navigation = createTypedRouter({
  home: { path: '/' },
  product: {
    path: '/products/[productId]',
    params: {
      productId: param.string(),
      referral: param.optional(param.enum(['search', 'featured'])),
    },
  },
  search: {
    path: '/search',
    params: {
      query: param.optional(param.string()),
      page: param.optional(param.number()),
      inStock: param.optional(param.boolean()),
      sort: param.optional(param.enum(['price', 'newest'])),
    },
  },
})

export const {
  routes,
  router,
  Link,
  Redirect,
  useRouter,
  useLocalSearchParams,
  useGlobalSearchParams,
} = navigation
```

`product` is an application alias; `/products/[productId]` matches the route file. `productId` fills the dynamic path segment, while `referral` becomes a query parameter. All the `search` params are query parameters because `/search` has no dynamic segments.

Dynamic segments must have required descriptors; missing or optional descriptors are rejected during initialization. Multiple aliases may share a path. Keep the config immutable after creation.

Your **`src/app/_layout.tsx`** uses Expo's normal navigator:

```tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack />
}
```

There is no call to `createTypedRouter` in the layout. Importing the shared navigation module gives each screen the same configured API.

## 3. Navigate from a screen with a lambda

Create **`src/app/index.tsx`**:

```tsx
import { Button, View } from 'react-native'
import { Link, useRouter } from '../navigation'

export default function HomeScreen() {
  const router = useRouter()

  return (
    <View>
      <Button
        title="Find available headphones"
        onPress={() => router.push((r) => r.search({
          query: 'headphones',
          page: 1,
          inStock: true,
          sort: 'price',
        }))}
      />
      <Link href={(r) => r.product({ productId: 'sku-42', referral: 'featured' })}>
        View featured headphones
      </Link>
    </View>
  )
}
```

Import `useRouter` and `Link` from **your navigation module** to get your config's types. The lambda receives the inferred route builders; `r.search` and `r.product` autocomplete with their parameter fields.

You can also import `routes` from that module and use `router.push(routes.product({ productId: 'sku-42' }))`. Both forms have the same typing. Routes without params use `r.home()`; routes with only optional params can use `r.search()`.

## 4. Read query params and update pagination

Create **`src/app/search.tsx`**:

```tsx
import { Button, Text, View } from 'react-native'
import { Link, useLocalSearchParams, useRouter } from '../navigation'

export default function SearchScreen() {
  const { query, page, inStock, sort } = useLocalSearchParams('search')
  const router = useRouter()
  const currentPage = page ?? 1

  // query: string | undefined
  // page: number | undefined
  // inStock: boolean | undefined
  // sort: 'price' | 'newest' | undefined
  // Pass these decoded values to your application's search API.

  return (
    <View>
      <Text>Search: {query ?? 'All products'}</Text>
      <Text>Page: {currentPage}</Text>
      <Text>{inStock ? 'In stock only' : 'Any availability'}</Text>
      <Text>Sort: {sort ?? 'newest'}</Text>
      <Button
        title="Next page"
        onPress={() => router.setParams('search', { page: currentPage + 1 })}
      />
      <Button
        title="Clear availability filter"
        onPress={() => router.setParams('search', { inStock: undefined })}
      />
      <Link href={(r) => r.product({ productId: 'sku-42', referral: 'search' })}>
        Open matching headphones
      </Link>
    </View>
  )
}
```

Opening `/search?query=headphones&page=2&inStock=true&sort=price` gives this screen a numeric `2` and boolean `true`. Missing optional values stay undefined; the screen chooses its own defaults.

`setParams('search', ...)` updates the **current screen**, preserving params you didn't include. The key selects the schema; it does not navigate to that route. Passing `undefined` removes an optional param. Required params cannot be removed.

## 5. Read a required dynamic parameter

Create **`src/app/products/[productId].tsx`**:

```tsx
import { Button, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from '../../navigation'

export default function ProductScreen() {
  const { productId, referral } = useLocalSearchParams('product')
  const router = useRouter()

  // productId: string; referral: 'search' | 'featured' | undefined
  // Use productId to fetch the product and referral for attribution.
  return (
    <View>
      <Text>Product: {productId}</Text>
      <Text>Opened from: {referral ?? 'a direct link'}</Text>
      <Button title="Back" onPress={() => router.back()} />
    </View>
  )
}
```

Hooks filter out undeclared URL keys and parse declared values. Invalid or missing required values throw `TypeError`; use your app's error boundary for malformed deep links. The hook key selects a schema and does not check the current pathname.

`useGlobalSearchParams(key)` uses the same parsing but reads the globally active URL. Use it only when that URL matches the selected schema: a background screen can otherwise receive another screen's params. Prefer the local hook for screen content.

## 6. Use Link in reusable components

Create **`src/components/ProductCard.tsx`**:

```tsx
import { Pressable, Text } from 'react-native'
import { Link } from '../navigation'

type ProductCardProps = { productId: string; title: string }

export function ProductCard({ productId, title }: ProductCardProps) {
  return (
    <Link href={(r) => r.product({ productId })} asChild>
      <Pressable>
        <Text>{title}</Text>
      </Pressable>
    </Link>
  )
}
```

The wrapped `Link` keeps Expo props and subcomponents such as `Link.Trigger`, `Link.Preview`, and `Link.Menu`. `Link.resolveHref` accepts the same typed destinations and lambdas.

For a redirect, import `Redirect` from your navigation module and render `<Redirect href={(r) => r.home()} />` when your screen's redirect condition is met.

## 7. Navigate outside a React component

Create **`src/services/openProduct.ts`**:

```ts
import { router } from '../navigation'

export function openProduct(productId: string) {
  router.push((r) => r.product({ productId }))
}
```

Call this from an event handler, such as a notification response handler, after the app's root navigator has mounted. Do not navigate as a side effect of importing the module. No React hook is needed here.

## API and parameter reference

`push`, `navigate`, `replace`, `dismissTo`, and `prefetch` accept typed destinations or lambdas and retain Expo's method options. `back`, `dismiss`, `dismissAll`, `canGoBack`, and `canDismiss` pass through. Unknown route names, missing required params, and incorrect values are TypeScript errors; builders also reject unknown parameter keys at runtime.

| Descriptor | Application value | URL behavior |
| --- | --- | --- |
| `param.string()` | `string` | Requires a single string |
| `param.number()` | `number` | Converts finite numbers |
| `param.boolean()` | `boolean` | Converts `true` and `false` |
| `param.enum(['price', 'newest'])` | `'price' \| 'newest'` | Validates the allowed values |
| `param.array(param.string())` | `string[]` | Normalizes a single value to an array |
| `param.optional(param.number())` | `number \| undefined` | Allows missing values |

For catch-all paths such as `/files/[...slug]`, declare `slug: param.array(param.string())`. Empty outgoing arrays are rejected because they cannot reliably round-trip through a URL.

Use `param.custom(parse, serialize)` for custom values. Parsers receive `string | string[] | undefined`, and serializers return that URL representation. Custom codecs must validate their own input and preserve round-trip behavior.

## Import boundaries and compatibility

- Import `createTypedRouter` and `param` from `typed-expo-router` in your shared config module.
- Import configured `router`, `Link`, `Redirect`, and hooks from your application's navigation module everywhere else.
- Import `Stack`, `Tabs`, `Slot`, and other unchanged APIs from `expo-router` or `typed-expo-router`.

Top-level `Link`, `router`, and search hooks re-exported by the package are Expo's original APIs. They do not know your config. They remain available for native Expo navigation, including external URLs; use your configured exports for this library's typing.

The factory also passes through other Expo Router root exports. Navigator screen names, nested href-bearing options, and subpath APIs such as `expo-router/ui` and native tabs retain Expo's types. Import subpath APIs directly from Expo Router. This version does not apply config typing to them or create route files.

Reference: [Expo Router API](https://docs.expo.dev/versions/latest/sdk/router/) and [Link API](https://docs.expo.dev/versions/latest/sdk/router/link/).

## Package development

```sh
npm run typecheck
npm run build
npm pack --dry-run
```

Build output includes JavaScript, declarations, and source maps. Expo Router, React, and React Native are peer dependencies.
