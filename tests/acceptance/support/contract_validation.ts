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

/** Validate the unadapted browser response against its actual frozen operation. */
export function validateBrowserResponse(method: string, pathname: string, status: number, raw: unknown): void {
  if (status < 200 || status >= 300) throw new Error('Browser product response HTTP ' + status);
  const segments = pathname.split('/');
  const template = Object.keys(document.paths).find(path => {
    const parts = path.split('/');
    return parts.length === segments.length && parts.every((part, index) =>
      part.startsWith('{') ? segments[index].length > 0 : part === segments[index]);
  });
  const operation = template && document.paths[template][method.toLowerCase()];
  const response = operation?.responses?.[String(status)];
  const schema = response?.content?.['application/json']?.schema?.$ref?.split('/').at(-1);
  if (!schema || !document.components.schemas[schema]) {
    throw new Error('Browser response has no frozen operation/schema.');
  }
  validateContract(schema as keyof Schemas, raw);
}

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
