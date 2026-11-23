const known = new Set([
  "$schema", "$id", "$ref", "$comment", "description", "title",
  "type", "properties", "required", "additionalProperties", "items",
  "definitions", "minLength", "maxLength", "pattern", "minimum", "maximum",
]);

export function assertSupported(schema, path = "") {
  if (schema == null || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`schema ${path || "/"} 不是对象`);
  }
  for (const key of Object.keys(schema)) {
    if (!known.has(key)) throw new Error(`不支持的 schema 关键字 ${path}/${key}`);
  }
  for (const [key, value] of Object.entries(schema.properties ?? {})) assertSupported(value, `${path}/properties/${key}`);
  for (const [key, value] of Object.entries(schema.definitions ?? {})) assertSupported(value, `${path}/definitions/${key}`);
  if (schema.items) assertSupported(schema.items, `${path}/items`);
}

function resolve(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`无法解析引用 ${ref}`);
  let node = root;
  for (const part of ref.slice(2).split("/")) {
    node = node?.[part];
    if (node == null) throw new Error(`无法解析引用 ${ref}`);
  }
  return node;
}

export function validate(schema, data) {
  assertSupported(schema);
  const errors = [];
  check(schema, data, "", errors, schema, "");
  return errors;
}

function check(schema, data, path, errors, root, title) {
  if (schema.$ref) {
    check(resolve(root, schema.$ref), data, path, errors, root, title);
    return;
  }
  const current = data && typeof data === "object" && typeof data.title === "string" ? data.title : title;
  const fail = (suffix, message) => errors.push({ path: `${path}${suffix}`, title: current, message });

  if (schema.type === "object") {
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      fail("", "应为对象");
      return;
    }
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(data, key)) fail(`/${key}`, "缺少字段");
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!schema.properties?.[key]) fail(`/${key}`, "不允许的字段");
      }
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(data, key)) check(sub, data[key], `${path}/${key}`, errors, root, current);
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(data)) {
      fail("", "应为数组");
      return;
    }
    data.forEach((item, index) => check(schema.items, item, `${path}/${index}`, errors, root, current));
    return;
  }

  if (schema.type === "string") {
    if (typeof data !== "string") {
      fail("", "应为字符串");
      return;
    }
    if (schema.minLength != null && data.length < schema.minLength) fail("", `至少 ${schema.minLength} 个字符`);
    if (schema.maxLength != null && data.length > schema.maxLength) fail("", `最多 ${schema.maxLength} 个字符`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(data)) fail("", "格式不正确");
    return;
  }

  if (schema.type === "integer") {
    if (!Number.isInteger(data)) {
      fail("", "应为整数");
      return;
    }
    if (schema.minimum != null && data < schema.minimum) fail("", `不能小于 ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) fail("", `不能大于 ${schema.maximum}`);
    return;
  }

  throw new Error(`不支持的 schema 类型 ${schema.type ?? "(未声明)"}`);
}
