/** Adapt the schema at this boundary; Zod still enforces every original constraint. */
export function strictJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ["type", "description", "title", "enum", "$ref"])
    if (schema[key] !== undefined) result[key] = schema[key];
  if (schema.const !== undefined) result.enum = [schema.const];
  if (Array.isArray(schema.anyOf))
    result.anyOf = schema.anyOf.map((value) => strictJsonSchema(value as Record<string, unknown>));
  if (schema.items && typeof schema.items === "object")
    result.items = strictJsonSchema(schema.items as Record<string, unknown>);
  if (schema.$defs && typeof schema.$defs === "object")
    result.$defs = Object.fromEntries(
      Object.entries(schema.$defs).map(([key, value]) => [
        key,
        strictJsonSchema(value as Record<string, unknown>),
      ]),
    );
  if (schema.properties && typeof schema.properties === "object") {
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => {
        const property = strictJsonSchema(value as Record<string, unknown>);
        return [key, required.has(key) ? property : { anyOf: [property, { type: "null" }] }];
      }),
    );
    result.required = Object.keys(schema.properties);
    result.additionalProperties = false;
  }
  return result;
}

export function restoreOptionalFields(value: unknown, schema: Record<string, unknown>): unknown {
  if (Array.isArray(value) && schema.items)
    return value.map((item) =>
      restoreOptionalFields(item, schema.items as Record<string, unknown>),
    );
  if (!value || typeof value !== "object" || !schema.properties) return value;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => item !== null || required.has(key))
      .map(([key, item]) => [
        key,
        properties[key] ? restoreOptionalFields(item, properties[key]) : item,
      ]),
  );
}
