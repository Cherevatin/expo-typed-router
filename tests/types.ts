import { param } from "../src/params";
import { buildRoutes, type RouteParams, type SchemaParams } from "../src/routes";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const config = {
  home: { path: "/" },
  product: {
    path: "/products/[productId]",
    params: {
      productId: param.string(),
      page: param.optional(param.number()),
      sort: param.optional(param.enum(["price", "newest"])),
    },
  },
} as const;

type ProductParams = RouteParams<typeof config, "product">;
type ExpectedProductParams = {
  productId: string;
} & {
  page?: number | undefined;
  sort?: "price" | "newest" | undefined;
};

type _productParamsOut = Expect<ProductParams extends ExpectedProductParams ? true : false>;
type _productParamsIn = Expect<ExpectedProductParams extends ProductParams ? true : false>;
type _homeParams = Expect<Equal<RouteParams<typeof config, "home">, Record<string, never>>>;
type _schemaParams = Expect<
  Equal<
    SchemaParams<{ required: ReturnType<typeof param.boolean>; optional: ReturnType<typeof optionalNumber> }>,
    { required: boolean } & { optional?: number | undefined }
  >
>;

function optionalNumber() {
  return param.optional(param.number());
}

const routes = buildRoutes(config);

routes.home();
// @ts-expect-error misspelled parameter keys are rejected
routes.product({ productId1: "sku-42" });
routes.product({ productId: "sku-42", page: 2, sort: "price" });

// @ts-expect-error required parameters cannot be omitted
routes.product();
// @ts-expect-error productId must be a string
routes.product({ productId: 42 });
// @ts-expect-error enum values are restricted to configured members
routes.product({ productId: "sku-42", sort: "popular" });
// @ts-expect-error unknown parameter keys are rejected
routes.product({ productId: "sku-42", referral: "search" });
// @ts-expect-error route aliases are inferred from the config
routes.search();
