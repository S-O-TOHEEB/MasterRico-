/**
 * Copies only the named keys from `source` onto a new object, skipping any
 * key whose value is `undefined`. Use this everywhere a DTO gets applied to
 * a persisted entity via Object.assign — a TypeScript interface on the DTO
 * type is a compile-time label, not a runtime filter, so
 * `Object.assign(entity, dto)` still copies every property actually present
 * on the object at runtime, including ones no legitimate caller sends but a
 * crafted request body can (role, isFlagged, creatorId, ...).
 *
 * Usage: Object.assign(entity, pickFields(dto, ["title", "description"]));
 */
export function pickFields<T extends object, K extends keyof T>(
  source: Partial<T> | Record<string, unknown>,
  keys: readonly K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    const value = (source as any)[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
