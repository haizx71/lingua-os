import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import type { components } from '../../../packages/types/src/generated/openapi';

type Schemas = components['schemas'];
const document = parse(readFileSync(resolve(__dirname, '../../../contracts/openapi.yaml'), 'utf8'));
// OpenAPI annotations are not validation keywords. Never coerce, default, or
// remove data: the original wire response must satisfy the frozen schema.
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const rootId = 'urn:lingua:frll:frozen-contract';
ajv.addSchema({ $id: rootId, components: document.components });
const validators = new Map<string, ValidateFunction>();

export function validateContract<K extends keyof Schemas>(schema: K, raw: unknown): Schemas[K] {
  let validate = validators.get(schema);
  if (!validate) {
    validate = ajv.compile({ $ref: `${rootId}#/components/schemas/${schema}` });
    validators.set(schema, validate);
  }
  if (!validate(raw)) {
    // Diagnostics contain schema paths, never raw payload or backend messages.
    const failures = validate.errors?.map(e => `${e.instancePath || '/'} ${e.keyword}`).join('; ');
    throw new Error(`Invalid ${schema} response: frozen OpenAPI validation failed (${failures}).`);
  }
  return raw as Schemas[K];
}
