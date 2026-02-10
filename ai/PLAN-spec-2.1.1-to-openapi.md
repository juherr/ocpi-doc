# Plan: Generate OpenAPI Files for OCPI 2.1.1

## Context

The OCPI 2.1.1 source specification is in `specifications/ocpi-2.1.1/`.

Goal: define and maintain OpenAPI 3.1.0 sources for OCPI 2.1.1 that are:
- spec-first (source semantics preserved),
- codegen-ready (stable reusable schemas),
- and aligned with current repository conventions where they do not conflict with 2.1.1.

## Design Decisions

### OpenAPI 3.1.0 (YAML)
- Use JSON Schema 2020-12 features where useful (`anyOf`, explicit nullable modeling, callbacks, webhooks).
- Keep source files readable and modular.

### Multi-file structure: one file per module + shared components

```
openapi/ocpi-2.1.1/
|- shared/
|  |- common.yaml
|  |- headers.yaml
|  |- parameters.yaml
|  `- schemas/
|     |- types.yaml
|     |- locations.yaml
|     |- tokens.yaml
|     `- cdrs.yaml
|- versions.yaml
|- credentials.yaml
|- locations.yaml
|- sessions.yaml
|- cdrs.yaml
|- tariffs.yaml
|- tokens.yaml
|- commands.yaml
`- openapi.yaml
```

**Total: 16 files** (8 module files + 7 shared files + 1 root aggregator).

### Sender and Receiver in the same module file
Each module keeps both interfaces with tags:
- `{Module} - Sender`
- `{Module} - Receiver`

### OCPI response envelope pattern
All typed responses use named schemas based on the OCPI envelope:
- single item: `<Entity>Response`
- collection: `<Entity>ListResponse`

Avoid repeated anonymous route-level wrappers.

### Open/extensible enums
Model extensible enums with `anyOf`:

```yaml
ExampleOpenEnum:
  anyOf:
    - type: string
      enum: [KNOWN_A, KNOWN_B]
    - type: string
```

### OCPI extensibility
Keep OCPI object extensibility behavior:

```yaml
additionalProperties: true
```

### Header modeling for 2.1.1
2.1.1 does not define correlation/routing headers (`X-Request-ID`, `X-Correlation-ID`, `OCPI-from-*`, `OCPI-to-*`).

Important distinction for 2.1.1:
- pagination headers are defined and MUST be modeled,
- correlation/routing headers from newer versions MUST NOT be introduced by default.

Use:
- request auth via `securitySchemes` (no explicit `Authorization` parameter),
- query/path parameters from module specs and pagination,
- pagination response headers (`Link`, `X-Total-Count`, `X-Limit`) where applicable.

## Key Delta vs 2.2.1 and 2.3.0

1. **No ChargingProfiles module in 2.1.1**
   - Do not create `charging-profiles.yaml`.

2. **No HubClientInfo module in 2.1.1**
   - Do not create `hub-client-info.yaml`.

3. **No Payments module in 2.1.1**
   - Do not create `payments.yaml`.

4. **ModuleID set is narrower in 2.1.1**
   - Known module IDs are: `cdrs`, `commands`, `credentials`, `locations`, `sessions`, `tariffs`, `tokens`.

5. **VersionNumber known values stop at 2.1.1**
   - Known values: `2.0`, `2.1`, `2.1.1` (open enum still allows custom values).

6. **Credentials model differs from newer versions**
   - `Credentials` in 2.1.1 contains `token`, `url`, `business_details`, `party_id`, `country_code`.
   - No `roles[]` structure from newer specs.

7. **Command payloads differ by command type**
   - Model command endpoints as fixed command-specific routes in OpenAPI (`/commands/RESERVE_NOW`, `/commands/START_SESSION`, `/commands/STOP_SESSION`, `/commands/UNLOCK_CONNECTOR`) so each route has a precise request schema.
   - Keep 2.1.1 command set only (do not introduce `CANCEL_RESERVATION`).

8. **No Charging Preferences endpoint in Sessions for 2.1.1**
   - Do not expose `/sessions/{session_id}/charging_preferences` in 2.1.1 OpenAPI.
   - Avoid claiming Charging Preferences support in 2.1.1 Sessions descriptions.

9. **No standardized routing/correlation headers in 2.1.1 text**
   - Avoid importing later-version header conventions into 2.1.1 source OpenAPI.

10. **`smart_charging.md` is explicitly TO BE DEFINED**
   - Exclude Smart Charging from normative OpenAPI module generation for 2.1.1.
   - Document it as intentional exclusion in the coverage matrix.

## Implementation Plan

### Phase 0: Baseline and gap analysis
1. Compare planned 2.1.1 OpenAPI coverage against:
   - `specifications/ocpi-2.1.1/*.md`
   - latest structure conventions from `openapi/ocpi-2.2.1/` and `openapi/ocpi-2.3.0/`
2. Build delta list:
   - missing/extra endpoints,
   - missing/duplicated schemas,
   - envelope modeling inconsistencies,
   - async modeling gaps.

### Phase 1: Foundation (`shared/`)
**Files:**
- `openapi/ocpi-2.1.1/shared/common.yaml`
- `openapi/ocpi-2.1.1/shared/headers.yaml`
- `openapi/ocpi-2.1.1/shared/parameters.yaml`
- `openapi/ocpi-2.1.1/shared/schemas/types.yaml`
- `openapi/ocpi-2.1.1/shared/schemas/locations.yaml`
- `openapi/ocpi-2.1.1/shared/schemas/tokens.yaml`
- `openapi/ocpi-2.1.1/shared/schemas/cdrs.yaml`

**Goals:**
- centralize truly shared schemas,
- avoid cross-module duplication,
- keep 2.1.1-only semantics (no newer-version schema drift).

**Baseline shared content:**
- `common.yaml`: generic OCPI envelope base schema(s),
- `headers.yaml`: pagination response headers (`Link`, `X-Total-Count`, `X-Limit`),
- `parameters.yaml`: pagination (`date_from`, `date_to`, `offset`, `limit`) + client-owned resource path params (`country_code`, `party_id`),
- `shared/schemas/types.yaml`: primitives and shared classes (`CiString`, `DateTime`, `DisplayText`, URL-like string modeling used by the spec),
- `shared/schemas/locations.yaml`: shared location classes (`BusinessDetails`, `Image`, `GeoLocation`, `EnergyMix`, etc.),
- `shared/schemas/tokens.yaml`: shared token classes (`LocationReferences`, token enums),
- `shared/schemas/cdrs.yaml`: shared CDR classes/enums (`AuthMethod`, CDR sub-objects reused by Sessions/CDRs).

### Phase 2: Configuration modules
**Files:**
- `openapi/ocpi-2.1.1/versions.yaml`
- `openapi/ocpi-2.1.1/credentials.yaml`

**Goals:**
- full endpoint coverage,
- named response wrappers for all responses,
- strict 2.1.1 object shapes (`Version`, `VersionDetails`, `Endpoint`, `Credentials`).

### Phase 3: Core functional modules
**Files:**
- `openapi/ocpi-2.1.1/locations.yaml`
- `openapi/ocpi-2.1.1/sessions.yaml`
- `openapi/ocpi-2.1.1/cdrs.yaml`
- `openapi/ocpi-2.1.1/tariffs.yaml`
- `openapi/ocpi-2.1.1/tokens.yaml`

**Goals:**
- Sender + Receiver parity with 2.1.1 markdown source,
- deduplicate shared schemas through `shared/schemas/*`,
- enforce named PUT and PATCH request schemas,
- preserve module-specific semantics (for example Token authorize and Session date filter behavior).

### Phase 4: Async module
**File:**
- `openapi/ocpi-2.1.1/commands.yaml`

**Goals:**
 - model Receiver-side CPO command requests on explicit command routes,
- model asynchronous response delivery to eMSP callback URL,
- include OpenAPI `callbacks` from command request to `response_url`,
- expose top-level `webhooks` for Sender-side async reception of command results,
- keep stable naming (`CommandResponse`, command request objects, command enums).

### Phase 5: Root aggregation
Generate root file:

```bash
node tools/generate-root-openapi.js 2.1.1
```

Expected output:
- `openapi/ocpi-2.1.1/openapi.yaml`,
- root `paths` refs for each module,
- root `webhooks` refs for async command callbacks.

### Phase 6: Validation and parity checks
1. YAML parse validation for all files.
2. Lint:

```bash
npx @redocly/cli lint openapi/ocpi-2.1.1/openapi.yaml
npx @redocly/cli lint openapi/ocpi-2.1.1/**/*.yaml
```

3. Build smoke tests:

```bash
npm run build:redoc
npm run build:swagger
```

4. UI parity checks:
- pagination headers appear on paginated list operations,
- callbacks and webhooks are rendered for Commands,
- reusable schemas are visible as named models.

5. Bundle integrity:

```bash
npx @redocly/cli bundle openapi/ocpi-2.1.1/openapi.yaml -o /tmp/ocpi-2.1.1.bundle.yaml
```

6. Coverage matrix:
- maintain endpoint/schema mapping from `specifications/ocpi-2.1.1/*.md` to `openapi/ocpi-2.1.1/**/*.yaml`,
- explicitly list intentional exclusions (Smart Charging chapter).

## Conventions

| Aspect | Convention |
|--------|------------|
| Schema names | PascalCase, preserving OCPI spec names exactly (`CDR`, `CdrDimension`, etc.) |
| Property names | snake_case, aligned with OCPI JSON payloads |
| Operation IDs | camelCase and stable across regenerations |
| Tags | Prefer 2.1.1 wording: `{Module} - CPO Interface`, `{Module} - eMSP Interface` |
| Descriptions | Normative wording aligned with source text (`MUST`, `SHALL`, `SHOULD`, `MAY`) |
| Objects | `additionalProperties: true` where OCPI extensibility applies |
| Cross references | Relative `$ref` links between files |
| Authentication | `securitySchemes` + top-level/module-level security (no `Authorization` header parameter) |
| Response wrappers | Named envelope wrappers (`<Entity>Response`, `<Entity>ListResponse`) |
| Async modeling | Commands documented with both `callbacks` and top-level `webhooks` |
| Header policy | Keep 2.1.1-defined headers/params (including pagination headers `Link`, `X-Total-Count`, `X-Limit`); do not inject newer correlation/routing headers |

### SDK compatibility note
- Keep existing `operationId` values stable (do not rename for terminology-only changes) to reduce breaking changes in generated SDKs during version upgrades.

## 2.1.1 Guardrails (Prevent Up-version Drift)

Before sign-off, run a focused review to ensure 2.1.1 scope remains clean:

- no `charging-profiles.yaml`, `hub-client-info.yaml`, or `payments.yaml`,
- no Sessions `charging_preferences` endpoint in 2.1.1,
- no newer-version credentials role model (`roles[]`),
- no newer-version ModuleID additions,
- no newer-version request/response headers absent from 2.1.1,
- no endpoint/schema copied from newer specs without 2.1.1 source basis,
- `smart_charging.md` remains explicitly excluded unless formalized in source spec.

## Refactor Objective (Single-Pass, All 2.1.1 Modules)

Priority order:
1. **respect-spec-before**: names and semantics follow 2.1.1 markdown source.
2. **codegen-first**: reusable and stable named schemas for SDK generation.

### Rules for this pass
- Refactor all 2.1.1 modules together.
- Keep module root entities (`Location`, `Session`, `CDR`, `Tariff`, `Token`, `CommandResponse`) as canonical contracts.
- Move only truly shared models to `shared/schemas/*`.
- Remove duplicated local definitions once shared refs exist.
- Replace repeated inline response envelopes with named response wrappers.
- Keep open enums extensible via `anyOf` where spec allows custom values.

### Acceptance criteria
- No duplicated shared schema definitions across modules.
- Shared refs reused consistently across modules.
- Named response wrappers used consistently.
- No unsupported 2.2.1/2.3.0 modules or headers introduced.
- `npm run build:redoc` and `npm run build:swagger` succeed.
- Bundled spec remains complete and semantically aligned with OCPI 2.1.1.

## Model Generation Rules (Spec-First, Codegen-Ready)

### Naming policy
- Keep OCPI names as-is (`CDR`, `CdrToken`, `CdrLocation`, etc.).
- Do not rename source schemas for cosmetic normalization.

### Response model policy
- Use named wrappers: `<Entity>Response`, `<Entity>ListResponse`.
- `ListResponse.data` is directly `type: array` with entity refs.
- Avoid unnecessary intermediate list-data wrappers.
- Keep response wrappers explicit (`status_code`, `status_message`, `timestamp`, typed `data`).

### PUT/PATCH request policy
- PUT request body references named full-object schemas.
- PATCH request body references named `*Patch` schemas.
- PATCH schemas define known fields explicitly and keep `additionalProperties: true` where extensibility applies.
- Keep `last_updated` requirements aligned per module as stated in 2.1.1.
- Include realistic examples derived from `specifications/ocpi-2.1.1/` examples.

### Swagger/UI bundling policy
- Keep root as modular `$ref` composition generated by `tools/generate-root-openapi.js`.
- Ensure generated Swagger output keeps reusable model visibility.

## Source Files Reviewed for 2.1.1

| Source file | Used for |
|-------------|----------|
| `transport_and_format.md` | response envelope, auth, pagination behavior, headers |
| `types.md` | primitive/shared type rules |
| `status_codes.md` | OCPI status code semantics |
| `version_information_endpoint.md` | versions endpoints, `VersionNumber`, `ModuleID` |
| `credentials.md` | credentials lifecycle and object shape |
| `mod_locations.md` | locations/EVSE/connector schemas and endpoints |
| `mod_sessions.md` | sessions schemas and push/pull behavior |
| `mod_cdrs.md` | CDR schemas and retrieval behavior |
| `mod_tariffs.md` | tariff schemas and filters |
| `mod_tokens.md` | token schemas and real-time authorization endpoint |
| `mod_commands.md` | async command flow and payloads |
| `smart_charging.md` | assessed as non-normative (`TO BE DEFINED`) exclusion |

## Deliverables

1. Plan file for OCPI 2.1.1 aligned with current OpenAPI rules and 2.1.1 scope.
2. OpenAPI sources under `openapi/ocpi-2.1.1/` with shared schema split.
3. Generated root file `openapi/ocpi-2.1.1/openapi.yaml`.
4. Endpoint + schema coverage matrix (`specifications/ocpi-2.1.1/*.md` -> `openapi/ocpi-2.1.1/**/*.yaml`).
5. Lint/build/bundle verification evidence plus rationale for any remaining warnings.
