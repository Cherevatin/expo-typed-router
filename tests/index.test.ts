import assert from "node:assert/strict";
import type { ReactElement } from "react";

function createRouter() {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    prefetch: jest.fn(),
    setParams: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
  };
}

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useMemo: (factory: () => unknown) => factory(),
}));

jest.mock("expo-router", () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    prefetch: jest.fn(),
    setParams: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
  };
  return {
    __esModule: true,
    router,
    Link: Object.assign(jest.fn(), {
      resolveHref: jest.fn((href: unknown) => JSON.stringify(href)),
      Trigger: Symbol("Link.Trigger"),
    }),
    Redirect: jest.fn(),
    useRouter: jest.fn(),
    useLocalSearchParams: jest.fn(),
    useGlobalSearchParams: jest.fn(),
    retainedExport: "retained",
  };
});

import { createTypedRouter } from "../src";
import { param } from "../src/params";

const mockExpoRouter = jest.requireMock("expo-router") as {
  router: ReturnType<typeof createRouter>;
  Link: jest.Mock & { resolveHref: jest.Mock; Trigger: symbol };
  useRouter: jest.Mock;
  useLocalSearchParams: jest.Mock;
  useGlobalSearchParams: jest.Mock;
};

const config = {
  home: { path: "/" },
  product: {
    path: "/products/[productId]",
    params: {
      productId: param.string(),
      page: param.optional(param.number()),
      available: param.optional(param.boolean()),
    },
  },
} as const;

describe("createTypedRouter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retains Expo exports and exposes route builders", () => {
    const navigation = createTypedRouter(config);

    assert.equal((navigation as unknown as { retainedExport: string }).retainedExport, "retained");
    assert.deepEqual(navigation.routes.product({ productId: "sku-42", page: 2 }), {
      pathname: "/products/[productId]",
      params: { productId: "sku-42", page: "2" },
    });
  });

  it.each(["push", "replace", "navigate", "dismissTo", "prefetch"] as const)(
    "resolves destinations passed to router.%s",
    (method) => {
      const navigation = createTypedRouter(config);
      const options = { test: true };

      navigation.router[method]((routes) => routes.product({ productId: "sku-42", available: true }), options as never);

      expect(mockExpoRouter.router[method]).toHaveBeenCalledWith(
        {
          pathname: "/products/[productId]",
          params: { productId: "sku-42", available: "true" },
        },
        options,
      );
    },
  );

  it("encodes partial setParams updates and preserves undefined", () => {
    const navigation = createTypedRouter(config);

    navigation.router.setParams("product", { page: 3, available: undefined });

    expect(mockExpoRouter.router.setParams).toHaveBeenCalledWith({
      page: "3",
      available: undefined,
    });
  });

  it("wraps the router returned by useRouter", () => {
    const hookRouter = createRouter();
    mockExpoRouter.useRouter.mockReturnValue(hookRouter);
    const navigation = createTypedRouter(config);
    const router = navigation.useRouter();

    router.push(navigation.routes.home());

    expect(hookRouter.push).toHaveBeenCalledWith({ pathname: "/", params: {} });
    assert.equal(router.back, hookRouter.back);
  });

  it("decodes local search parameters with the selected schema", () => {
    mockExpoRouter.useLocalSearchParams.mockReturnValue({
      productId: "sku-42",
      page: "2",
      available: "false",
      ignored: "value",
    });
    const navigation = createTypedRouter(config);

    assert.deepEqual(navigation.useLocalSearchParams("product"), {
      productId: "sku-42",
      page: 2,
      available: false,
    });
  });

  it("decodes global search parameters with the selected schema", () => {
    mockExpoRouter.useGlobalSearchParams.mockReturnValue({ productId: "sku-42", page: "4" });
    const navigation = createTypedRouter(config);

    assert.deepEqual(navigation.useGlobalSearchParams("product"), {
      productId: "sku-42",
      page: 4,
    });
  });

  it("resolves Link destinations and retains static members", () => {
    const navigation = createTypedRouter(config);
    const destination = navigation.routes.product({ productId: "sku-42" });
    const element = navigation.Link({ href: () => destination } as never) as ReactElement<{
      href: unknown;
    }>;

    assert.equal(navigation.Link.Trigger, mockExpoRouter.Link.Trigger);
    assert.deepEqual(element.props.href, destination);
    assert.equal(
      navigation.Link.resolveHref(() => destination),
      JSON.stringify(destination),
    );
    expect(mockExpoRouter.Link.resolveHref).toHaveBeenCalledWith(destination);
  });

  it("resolves Redirect destinations", () => {
    const navigation = createTypedRouter(config);
    const destination = navigation.routes.home();
    const element = navigation.Redirect({ href: () => destination } as never) as ReactElement<{
      href: unknown;
    }>;

    assert.deepEqual(element.props.href, destination);
  });
});
