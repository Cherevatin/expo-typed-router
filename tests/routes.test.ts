import assert from "node:assert/strict";

import { param } from "../src/params";
import { buildRoutes, decode, encode, type RouteConfig } from "../src/routes";

const schema = {
  productId: param.string(),
  page: param.optional(param.number()),
  available: param.optional(param.boolean()),
  tags: param.optional(param.array(param.string())),
};

describe("encode", () => {
  it("serializes declared values and omits absent optional values", () => {
    assert.deepEqual(
      encode(schema, {
        productId: "sku-42",
        page: 2,
        available: false,
        tags: ["sale", "audio"],
      }),
      {
        productId: "sku-42",
        page: "2",
        available: "false",
        tags: ["sale", "audio"],
      },
    );

    assert.deepEqual(encode(schema, { productId: "sku-42" }), { productId: "sku-42" });
  });

  it("rejects missing required and unknown parameters", () => {
    assert.throws(() => encode(schema, {}), {
      name: "TypeError",
      message: "Missing parameter: productId",
    });
    assert.throws(() => encode(schema, { productId: "sku-42", extra: true }), {
      name: "TypeError",
      message: "Unknown parameter: extra",
    });
  });

  it("only encodes supplied fields in partial mode", () => {
    assert.deepEqual(encode(schema, { page: 3 }, true), { page: "3" });
    assert.deepEqual(encode(schema, { page: undefined }, true), {});
    assert.throws(() => encode(schema, { productId: undefined }, true), {
      name: "TypeError",
      message: "Missing parameter: productId",
    });
  });
});

describe("decode", () => {
  it("parses declared values and ignores undeclared URL parameters", () => {
    assert.deepEqual(
      decode(schema, {
        productId: "sku-42",
        page: "2",
        available: "true",
        tags: ["sale", "audio"],
        ignored: "value",
      }),
      {
        productId: "sku-42",
        page: 2,
        available: true,
        tags: ["sale", "audio"],
      },
    );
  });

  it("omits missing optional values and rejects missing required values", () => {
    assert.deepEqual(decode(schema, { productId: "sku-42" }), { productId: "sku-42" });
    assert.throws(() => decode(schema, {}), {
      name: "TypeError",
      message: "Expected one URL parameter value",
    });
  });
});

describe("buildRoutes", () => {
  it("creates named builders with encoded destinations", () => {
    const routes = buildRoutes({
      home: { path: "/" },
      product: { path: "/products/[productId]", params: schema },
    });

    assert.equal(Object.getPrototypeOf(routes), null);
    assert.deepEqual(routes.home(), { pathname: "/", params: {} });
    assert.deepEqual(routes.product({ productId: "sku-42", page: 2 }), {
      pathname: "/products/[productId]",
      params: { productId: "sku-42", page: "2" },
    });
  });

  it("rejects invalid paths", () => {
    for (const path of ["relative", "/search?query=x", "/article#section"]) {
      assert.throws(() => buildRoutes({ invalid: { path } } as RouteConfig), {
        name: "TypeError",
        message: "Route invalid must have an absolute pathname without a query or hash",
      });
    }
  });

  it("requires non-optional descriptors for every dynamic segment", () => {
    assert.throws(() => buildRoutes({ product: { path: "/products/[productId]" } }), {
      name: "TypeError",
      message: "Route product requires parameter productId",
    });
    assert.throws(
      () =>
        buildRoutes({
          product: {
            path: "/products/[productId]",
            params: { productId: param.optional(param.string()) },
          },
        }),
      {
        name: "TypeError",
        message: "Route product requires parameter productId",
      },
    );
  });

  it("validates catch-all dynamic segments", () => {
    const routes = buildRoutes({
      docs: { path: "/docs/[...parts]", params: { parts: param.array(param.string()) } },
    });

    assert.deepEqual(routes.docs({ parts: ["guides", "routing"] }), {
      pathname: "/docs/[...parts]",
      params: { parts: ["guides", "routing"] },
    });
  });
});
