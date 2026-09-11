import assert from "node:assert/strict";

import { param } from "../src/params";

describe("parameter codecs", () => {
  it("parses and serializes strings", () => {
    const descriptor = param.string();

    assert.equal(descriptor.optional, false);
    assert.equal(descriptor.parse("hello"), "hello");
    assert.equal(descriptor.serialize("hello"), "hello");
    assert.throws(() => descriptor.parse(["hello"]), {
      name: "TypeError",
      message: "Expected one URL parameter value",
    });
    assert.throws(() => descriptor.serialize(1 as never), TypeError);
  });

  it("accepts finite numbers and rejects invalid numeric values", () => {
    const descriptor = param.number();

    assert.equal(descriptor.parse("1.25"), 1.25);
    assert.equal(descriptor.parse("-3"), -3);
    assert.equal(descriptor.serialize(1.25), "1.25");

    for (const value of ["", "  ", "Infinity", "not-a-number"]) {
      assert.throws(() => descriptor.parse(value), {
        name: "TypeError",
        message: "Expected a finite number",
      });
    }
    for (const value of [Infinity, NaN, "1"]) {
      assert.throws(() => descriptor.serialize(value as never), TypeError);
    }
  });

  it("only accepts literal boolean representations", () => {
    const descriptor = param.boolean();

    assert.equal(descriptor.parse("true"), true);
    assert.equal(descriptor.parse("false"), false);
    assert.equal(descriptor.serialize(true), "true");
    assert.equal(descriptor.serialize(false), "false");
    assert.throws(() => descriptor.parse("1"), {
      name: "TypeError",
      message: "Expected true or false",
    });
    assert.throws(() => descriptor.serialize("true" as never), TypeError);
  });

  it("validates enum members in both directions", () => {
    const descriptor = param.enum(["newest", "price"]);

    assert.equal(descriptor.parse("price"), "price");
    assert.equal(descriptor.serialize("newest"), "newest");
    assert.throws(() => descriptor.parse("popular"), {
      name: "TypeError",
      message: "Expected one of: newest, price",
    });
    assert.throws(() => descriptor.serialize("popular" as never), TypeError);
  });

  it("normalizes scalar and repeated array parameters", () => {
    const descriptor = param.array(param.number());

    assert.deepEqual(descriptor.parse("2"), [2]);
    assert.deepEqual(descriptor.parse(["2", "3"]), [2, 3]);
    assert.deepEqual(descriptor.serialize([2, 3]), ["2", "3"]);
    assert.throws(() => descriptor.parse(undefined), {
      name: "TypeError",
      message: "Expected an array parameter",
    });
    assert.throws(() => descriptor.serialize([]), {
      name: "TypeError",
      message: "Expected a nonempty array",
    });
    assert.throws(() => param.array(param.optional(param.string())).serialize([undefined]), {
      name: "TypeError",
      message: "Array items must serialize to strings",
    });
  });

  it("passes missing values through optional descriptors", () => {
    const descriptor = param.optional(param.number());

    assert.equal(descriptor.optional, true);
    assert.equal(descriptor.parse(undefined), undefined);
    assert.equal(descriptor.serialize(undefined), undefined);
    assert.equal(descriptor.parse("4"), 4);
    assert.equal(descriptor.serialize(4), "4");
  });

  it("supports custom parsing and serialization", () => {
    const descriptor = param.custom(
      (value) => new Date(param.string().parse(value)),
      (value) => value.toISOString(),
    );
    const date = descriptor.parse("2026-09-11T00:00:00.000Z");

    assert.equal(date.toISOString(), "2026-09-11T00:00:00.000Z");
    assert.equal(descriptor.serialize(date), "2026-09-11T00:00:00.000Z");
  });
});
