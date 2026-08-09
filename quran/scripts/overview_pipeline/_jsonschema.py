"""
Minimal, zero-dependency JSON Schema validator — just the subset our schema
files use (type, const, enum, required, properties, additionalProperties, items,
minItems, local $ref into $defs). Kept self-contained so the pipeline validates
claims against data/schemas/extracted_claim.schema.json with no extra install.

    validate(instance, schema) -> list[str]   # empty == valid
"""

_TYPES = {"object": dict, "array": list, "string": str, "boolean": bool,
          "number": (int, float), "integer": int}


def _resolve(root, ref):
    node = root
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def _validate(inst, schema, root, path, errors):
    if "$ref" in schema:
        schema = _resolve(root, schema["$ref"])
    if "const" in schema:
        if inst != schema["const"]:
            errors.append(f"{path}: expected {schema['const']!r}")
        return
    if "enum" in schema:
        if inst not in schema["enum"]:
            errors.append(f"{path}: {inst!r} not in {schema['enum']}")
        return
    if "type" in schema:
        py = _TYPES[schema["type"]]
        ok = isinstance(inst, py)
        if isinstance(inst, bool) and py is not bool:
            ok = False
        if not ok:
            errors.append(f"{path}: expected {schema['type']}, got {type(inst).__name__}")
            return
    if isinstance(inst, dict):
        props = schema.get("properties", {})
        for k in schema.get("required", []):
            if k not in inst:
                errors.append(f"{path}: missing '{k}'")
        if schema.get("additionalProperties", True) is False:
            for k in inst:
                if k not in props:
                    errors.append(f"{path}: unexpected '{k}'")
        for k, v in inst.items():
            if k in props:
                _validate(v, props[k], root, f"{path}.{k}", errors)
    if isinstance(inst, list):
        if "minItems" in schema and len(inst) < schema["minItems"]:
            errors.append(f"{path}: needs >= {schema['minItems']} items")
        item = schema.get("items")
        if item is not None:
            for i, v in enumerate(inst):
                _validate(v, item, root, f"{path}[{i}]", errors)


def validate(instance, schema):
    errors = []
    _validate(instance, schema, schema, "", errors)
    return errors
