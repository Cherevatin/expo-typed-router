export type RawParam = string | string[] | undefined

export interface Param<T> {
  readonly optional: boolean
  parse(value: RawParam): T
  serialize(value: T): string | string[] | undefined
}

function scalar(value: RawParam): string {
  if (typeof value !== 'string') throw new TypeError('Expected one URL parameter value')
  return value
}

function codec<T>(parse: (value: RawParam) => T, serialize: Param<T>['serialize']): Param<T> {
  return { optional: false, parse, serialize }
}

const string = () => codec(scalar, (value: string) => scalar(value))
const number = () => codec((value) => {
  const text = scalar(value)
  const result = Number(text)
  if (!text.trim() || !Number.isFinite(result)) throw new TypeError('Expected a finite number')
  return result
}, (value: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected a finite number')
  return String(value)
})
const boolean = () => codec((value) => {
  if (value === 'true') return true
  if (value === 'false') return false
  throw new TypeError('Expected true or false')
}, (value: boolean) => {
  if (typeof value !== 'boolean') throw new TypeError('Expected a boolean')
  return String(value)
})

export const param = {
  string,
  number,
  boolean,
  enum<const T extends readonly [string, ...string[]]>(values: T): Param<T[number]> {
    const validate = (value: RawParam): T[number] => {
      const result = scalar(value)
      if (!values.includes(result)) throw new TypeError(`Expected one of: ${values.join(', ')}`)
      return result
    }
    return codec<T[number]>(validate, validate)
  },
  array<T>(item: Param<T>): Param<T[]> {
    return codec((value) => {
      if (value === undefined) throw new TypeError('Expected an array parameter')
      return (Array.isArray(value) ? value : [value]).map((entry) => item.parse(entry))
    }, (values: T[]) => {
      if (!Array.isArray(values) || values.length === 0) throw new TypeError('Expected a nonempty array')
      return values.map((value) => {
        const result = item.serialize(value)
        if (typeof result !== 'string') throw new TypeError('Array items must serialize to strings')
        return result
      })
    })
  },
  optional<T>(item: Param<T>): Param<T | undefined> {
    return {
      optional: true,
      parse: (value) => value === undefined ? undefined : item.parse(value),
      serialize: (value) => value === undefined ? undefined : item.serialize(value),
    }
  },
  custom: codec,
}
