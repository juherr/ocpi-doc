# Plan: Refresh OpenAPI Files for OCPI 2.2.1

## Context

The OCPI 2.2.1 source specification is in `specifications/ocpi-2.2.1/`. A plan file already exists, but it needs to be aligned with the latest OpenAPI generation rules now used for 2.3.0 (shared schema split, named response wrappers, strict header grouping, callbacks + webhooks strategy).

Goal: refresh and maintain OpenAPI 3.1.0 sources for OCPI 2.2.1 in a way that is:
- spec-first (AsciiDoc semantics preserved),
- codegen-ready (stable reusable models),
- and consistent with current repository conventions.

## Design Decisions

### OpenAPI 3.1.0 (YAML)
- Keep parity with `openapi/ocpi-2.3.0/` standards.
- Use JSON Schema 2020-12 features (`anyOf`, explicit nullability patterns, callbacks, webhooks).
- Keep source readable and maintainable.

### Multi-file structure: one file per module + shared components

```
openapi/ocpi-2.2.1/
├── shared/
│   ├── common.yaml
│   ├── headers.yaml
│   ├── parameters.yaml
│   └── schemas/
│       ├── types.yaml
│       ├── locations.yaml
│       ├── tokens.yaml
│       └── cdrs.yaml
├── versions.yaml
├── credentials.yaml
├── locations.yaml
├── sessions.yaml
├── cdrs.yaml
├── tariffs.yaml
├── tokens.yaml
├── commands.yaml
├── charging-profiles.yaml
├── hub-client-info.yaml
└── openapi.yaml
```

**Total: 18 files** (10 module files + 7 shared files + 1 root aggregator).

### Sender and Receiver in the same module file
Each module keeps both interfaces with tags:
- `{Module} - Sender`
- `{Module} - Receiver`

### OCPI response envelope pattern
All typed responses use named schemas based on the OCPI envelope:
- single item: `<Entity>Response`
- collection: `<Entity>ListResponse`

No repeated anonymous route-level wrappers.

### Open/extensible enums
Use `anyOf`:

```yaml
ExampleOpenEnum:
  anyOf:
    - type: string
      enum: [KNOWN_A, KNOWN_B]
    - type: string
```

### OCPI extensibility
Objects that are extensible in OCPI remain:

```yaml
additionalProperties: true
```

### Header deduplication and grouping
- Shared request headers at `paths.<path>.parameters` where possible.
- Keep operation-level parameters for operation-specific entries only.
- Group headers with comments:
  - `# Correlation headers`
  - `# Routing headers`
  - `# Pagination headers` (responses)
- Keep `versions.yaml`, `credentials.yaml`, and `hub-client-info.yaml` without routing headers unless explicitly required by the module contract.

## Key Delta vs 2.3.0

1. **No Payments module in 2.2.1**
   - Do not create `payments.yaml`.
   - Ensure `ModuleID` known values exclude Payments.

2. **Role enum is narrower in 2.2.1**
   - Keep known values from 2.2.1 only (`CPO`, `EMSP`, `HUB`, `NAP`, `NSP`, `OTHER`).
   - Do not import 2.3.0 additions (`SCSP`, `PTP`, `PSP`).

3. **Version known values stop at 2.2.1**
   - Keep `VersionNumber` known values capped to 2.2.1, while preserving open-enum extensibility.

4. **Module set for 2.2.1**
   - `versions`, `credentials`, `locations`, `sessions`, `cdrs`, `tariffs`, `tokens`, `commands`, `charging-profiles`, `hub-client-info`.

## Implementation Plan

### Phase 0: Baseline and gap analysis
1. Compare current 2.2.1 OpenAPI sources against:
   - `specifications/ocpi-2.2.1/*.asciidoc`
   - `openapi/ocpi-2.3.0/` structure and latest rules
2. Build a delta list:
   - missing/extra endpoints,
   - missing/duplicated schemas,
   - non-uniform header placement,
   - missing callbacks/webhooks.

### Phase 1: Foundation (`shared/`)
**Files:**
- `openapi/ocpi-2.2.1/shared/common.yaml`
- `openapi/ocpi-2.2.1/shared/headers.yaml`
- `openapi/ocpi-2.2.1/shared/parameters.yaml`
- `openapi/ocpi-2.2.1/shared/schemas/types.yaml`
- `openapi/ocpi-2.2.1/shared/schemas/locations.yaml`
- `openapi/ocpi-2.2.1/shared/schemas/tokens.yaml`
- `openapi/ocpi-2.2.1/shared/schemas/cdrs.yaml`

**Goals:**
- centralize truly shared models/enums,
- keep a single source of truth,
- align shared enums (`Role`, shared token/cdr/location enums) to 2.2.1 semantics.

### Phase 2: Configuration modules
**Files:**
- `openapi/ocpi-2.2.1/versions.yaml`
- `openapi/ocpi-2.2.1/credentials.yaml`

**Goals:**
- full endpoint coverage,
- response schemas converted to named wrappers,
- no unnecessary routing headers (configuration modules keep only correlation headers by default).

### Phase 3: Core functional modules
**Files:**
- `locations.yaml`
- `sessions.yaml`
- `cdrs.yaml`
- `tariffs.yaml`
- `tokens.yaml`

**Goals:**
- Sender + Receiver parity with 2.2.1 AsciiDoc,
- remove duplicated local models now available in `shared/schemas/*`,
- enforce PUT/PATCH schema rules (named full + named patch schemas).

### Phase 4: Async modules
**Files:**
- `commands.yaml`
- `charging-profiles.yaml`

**Goals:**
- callbacks from Receiver operations to `response_url`,
- top-level webhooks for Sender-side async result reception,
- named response/result schemas for all async flows,
- stable naming for async artifacts (`CommandResult`, `ActiveChargingProfileResult`, `ChargingProfileResult`, `ClearProfileResult`) across callbacks and webhooks.

### Phase 5: Specialized module
**File:**
- `hub-client-info.yaml`

**Goals:**
- full sender/receiver operations,
- `ClientInfo` and `ConnectionStatus` aligned with spec,
- shared headers and response wrappers aligned with latest conventions,
- no OCPI routing headers (configuration module; keep only correlation headers).

### Phase 6: Root aggregation
Generate root file:

```bash
node tools/generate-root-openapi.js 2.2.1
```

Expected output:
- `openapi/ocpi-2.2.1/openapi.yaml`
- root `paths` `$ref` entries for each module
- root `webhooks` `$ref` entries for async modules

### Phase 7: Validation and parity checks
1. YAML parse validation for all files.
2. Lint:

```bash
npx @redocly/cli lint openapi/ocpi-2.2.1/openapi.yaml
npx @redocly/cli lint openapi/ocpi-2.2.1/**/*.yaml
```

3. Build smoke tests:

```bash
npm run build:redoc
npm run build:swagger
```

4. UI parity checks:
- effective request headers remain visible after path-level grouping,
- callbacks and webhooks rendered,
- models panel shows reusable named schemas.
5. Bundle integrity checks:

```bash
npx @redocly/cli bundle openapi/ocpi-2.2.1/openapi.yaml -o /tmp/ocpi-2.2.1.bundle.yaml
```

6. Coverage matrix verification:
- maintain an endpoint and schema coverage matrix mapping 2.2.1 AsciiDoc sources to OpenAPI paths/components,
- document and justify any intentional exclusions.

## Conventions

| Aspect | Convention |
|--------|------------|
| Schema names | PascalCase, preserving OCPI spec names exactly (`CDR`, `CdrToken`) |
| Property names | snake_case, aligned with OCPI JSON payloads |
| Operation IDs | camelCase and stable across regenerations |
| Tags | `{Module} - Sender`, `{Module} - Receiver` |
| Descriptions | Normative wording aligned with AsciiDoc (`MUST`, `SHALL`, `SHOULD`, `MAY`) |
| Objects | `additionalProperties: true` where OCPI requires extensibility |
| Cross references | Relative `$ref` links between files |
| Authentication | `securitySchemes` + top-level `security` (no `Authorization` header parameter) |
| Response headers | Correlation and pagination headers modeled explicitly in responses |
| Async modeling | Commands and ChargingProfiles documented with both `callbacks` and top-level `webhooks` |
| Request header placement | Path-level `parameters` for shared OCPI headers; operation-level only for operation-specific parameters |
| Header grouping comments | Use `# Correlation headers`, `# Routing headers`, `# Pagination headers` consistently |
| Header exceptions | No OCPI routing headers in `versions.yaml`, `credentials.yaml`, and `hub-client-info.yaml` unless explicitly required |

## 2.2.1 Guardrails (Prevent 2.3.0 Drift)

Before validation sign-off, run a focused review to ensure 2.2.1 remains cleanly scoped:

- no `payments.yaml` module,
- no 2.3.0-only `Role` values (`SCSP`, `PTP`, `PSP`) in 2.2.1 shared enums,
- no 2.3.0-only module IDs in `ModuleID`,
- no endpoint/schema accidentally copied from 2.3.0 without 2.2.1 AsciiDoc basis,
- no request/response fields added solely for 2.3.0 convenience.

## Refactor Objective (Single-Pass, All 2.2.1 Modules)

Priority order:
1. **respect-spec-before**: schema names and behavior follow 2.2.1 AsciiDoc.
2. **codegen-first**: reusable and stable named schemas for generators.

### Rules for this pass
- Refactor all 2.2.1 modules together.
- Keep module root entities (`CDR`, `Session`, `Token`, `Tariff`, etc.) as canonical contracts.
- Move only truly shared models to `shared/schemas/*`.
- Remove duplicated definitions once shared refs exist.
- Replace repeated inline envelopes with named response schemas.
- Keep OCPI extensibility (`additionalProperties: true`) where required.
- Keep open enums extensible via `anyOf`.

### Acceptance criteria
- No duplicated shared schema definitions across module files.
- Shared schema refs reused across modules.
- Named response wrappers used consistently (no repetitive anonymous wrappers).
- Header grouping strategy applied consistently.
- `npm run build:redoc` and `npm run build:swagger` succeed.
- Bundled spec remains complete and semantically aligned to OCPI 2.2.1.

## Model Generation Rules (Spec-First, Codegen-Ready)

### Naming policy
- Keep OCPI spec names as-is (`CDR`, `CdrToken`, `CdrLocation`, etc.).
- Do not rename source schemas for cosmetic normalization.

### Response model policy
- Use named schemas: `<Entity>Response`, `<Entity>ListResponse`.
- List responses define `data` directly as an array of entity refs.
- Avoid unnecessary intermediate list-data wrappers.
- Keep response schemas explicit objects with `status_code`, `status_message`, `timestamp`, and typed `data`.

### PUT/PATCH request policy
- PUT request body references named full-object schemas.
- PATCH request body references named `*Patch` schemas.
- PATCH schemas define known fields explicitly and keep `additionalProperties: true`.
- When required by OCPI 2.2.1, keep `last_updated` required in patch payloads.
- Include realistic request examples from `specifications/ocpi-2.2.1/examples/`.

### Swagger/UI bundling policy
- Keep root as modular `$ref` composition generated by `tools/generate-root-openapi.js`.
- Ensure generated Swagger output preserves reusable model visibility.

## Header Grouping Migration Steps

1. For each functional module, identify paths sharing the full OCPI request header set.
2. Move those header refs to `paths.<path>.parameters` with grouped comments.
3. Keep only operation-specific parameters at operation level.
4. For configuration modules (`versions`, `credentials`, `hub-client-info`), keep only correlation headers unless the spec explicitly requires routing headers.
5. Keep response headers on responses with grouped comments.
6. Run Redocly lint and resolve parameter merge warnings.
7. Verify in Swagger UI that effective headers per operation are unchanged.

## Source Files Reviewed for 2.2.1

| Source file | Used for |
|-------------|----------|
| `transport_and_format.asciidoc` | response envelope, headers, pagination, routing |
| `types.asciidoc` | shared classes and enums (`Role`, `DisplayText`, `Price`, etc.) |
| `status_codes.asciidoc` | OCPI status code mapping |
| `version_information_endpoint.asciidoc` | versions endpoints and objects |
| `credentials.asciidoc` | credentials lifecycle |
| `mod_locations.asciidoc` | locations schemas and endpoints |
| `mod_sessions.asciidoc` | sessions and charging preferences |
| `mod_cdrs.asciidoc` | cdr schemas and endpoint behavior |
| `mod_tariffs.asciidoc` | tariffs schemas and filters |
| `mod_tokens.asciidoc` | tokens schemas and authorization endpoint |
| `mod_commands.asciidoc` | async commands flow and result payloads |
| `mod_charging_profiles.asciidoc` | charging profiles async flow |
| `mod_hub_client_info.asciidoc` | client info payload and status |

## Deliverables

1. Updated plan aligned with latest OpenAPI rules for 2.2.1.
2. Refreshed OpenAPI sources under `openapi/ocpi-2.2.1/` with shared schema split.
3. Generated root file `openapi/ocpi-2.2.1/openapi.yaml`.
4. Endpoint + schema coverage matrix (`specifications/ocpi-2.2.1/*.asciidoc` -> `openapi/ocpi-2.2.1/**/*.yaml`).
5. Lint/build/bundle verification evidence and any residual warning rationale.
