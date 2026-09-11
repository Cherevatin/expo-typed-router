// In your app, place this file at src/navigation/index.ts and import from
// 'typed-expo-router'. This relative import keeps the repository example local.
import { createTypedRouter, param } from '../src'

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
  routes, router, Link, Redirect, useRouter,
  useLocalSearchParams, useGlobalSearchParams,
} = navigation

// Call from a press handler after the app's root navigator has mounted.
export function openFeaturedProduct(productId: string) {
  router.push((r) => r.product({ productId, referral: 'featured' }))
}
