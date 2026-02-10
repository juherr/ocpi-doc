# Plan: Generate OpenAPI Files for OCPI 2.3.0

## Context

The OCPI 2.3.0 source specification is in `specifications/ocpi-2.3.0/`. The goal is to maintain OpenAPI 3.1.0 sources that fully cover OCPI 2.3.0 in a way that is:
- spec-first (AsciiDoc semantics preserved),
- codegen-ready (stable reusable models),
- and consistent with current repository conventions.

## Design Decisions

### OpenAPI 3.1.0 (YAML)
- Compatible with JSON Schema 2020-12 (better modeling of complex types)
- Native support for `null`, `const`, and `anyOf` for open enums
- `callbacks` support for async patterns (Commands, ChargingProfiles)
- YAML is more readable than JSON for a spec of this size

### Multi-file structure: one file per module + shared components
A good balance between maintainability and ease of use.

```
openapi/ocpi-2.3.0/
├── shared/
│   ├── common.yaml            # OCPI response envelope base schema(s)
│   ├── headers.yaml           # Common headers (Auth, X-Request-ID, routing, pagination)
│   └── parameters.yaml        # Reusable parameters (pagination, country_code, party_id)
│   └── schemas/
│       ├── types.yaml         # Shared primitive/value classes (DateTime, DisplayText, Price, TaxAmount, Role, ...)
│       ├── locations.yaml     # Shared location-related classes (GeoLocation, BusinessDetails, Hours, Image, EnergyMix, ...)
│       ├── tokens.yaml        # Shared token classes/enums (TokenType, WhitelistType, AllowedType, ...)
│       └── cdrs.yaml          # Shared CDR classes/enums (CdrToken, CdrLocation, ChargingPeriod, ...)
├── versions.yaml              # Versions module (GET versions, GET version details)
├── credentials.yaml           # Credentials module (GET, POST, PUT, DELETE)
├── locations.yaml             # Locations module (Sender + Receiver, split tags)
├── sessions.yaml              # Sessions module + ChargingPreferences
├── cdrs.yaml                  # CDRs module
├── tariffs.yaml               # Tariffs module
├── tokens.yaml                # Tokens module + real-time authorization
├── commands.yaml              # Commands module (async callbacks)
├── charging-profiles.yaml     # ChargingProfiles module (async callbacks)
├── hub-client-info.yaml       # Hub Client Info module
├── payments.yaml              # Payments module (Terminals + FAC)
└── openapi.yaml               # Root aggregator generated from module refs
```

**Total: 19 files (~5,600 YAML lines)** (11 module files + 7 shared files + 1 root aggregator)

### Sender vs Receiver in the same file
Each module file contains both interfaces (Sender and Receiver), separated by OpenAPI tags (`Locations - Sender`, `Locations - Receiver`). This provides:
- Fewer files to manage (19 instead of ~25)
- Schemas colocated with the endpoints that use them
- Code generation tools can filter by tag

### Pattern for the OCPI response envelope
Every OCPI response is wrapped in `{data, status_code, status_message, timestamp}`.
Use named typed response schemas (`<Entity>Response`, `<Entity>ListResponse`) with explicit object fields.
Avoid route-level anonymous wrappers and avoid `allOf` wrappers when explicit schemas improve code generation clarity.

### Open enums (extensible enums)
Modeled with `anyOf`:
```yaml
ConnectorType:
  anyOf:
    - type: string
      enum: [CHADEMO, IEC_62196_T2, ...]  # Known values
    - type: string                          # Custom values allowed
```

### Async patterns (Commands, ChargingProfiles)
Use OpenAPI 3.1.0 `callbacks` on Receiver endpoints to document the async POST to `response_url`.
Additionally, use top-level `webhooks` (OpenAPI 3.1.0) to formally document the Sender-side
endpoints that receive async results (CommandResult, ActiveChargingProfileResult,
ChargingProfileResult, ClearProfileResult). Both approaches are complementary: callbacks show
the link from Receiver to response_url, while webhooks provide a standalone Sender interface
specification for implementers. Keep async artifact names stable across callbacks and webhooks
(`CommandResult`, `ActiveChargingProfileResult`, `ChargingProfileResult`, `ClearProfileResult`).

### OCPI extensibility
All objects use `additionalProperties: true` (OCPI forbids rejecting unknown fields).

### Header deduplication and grouping
To reduce repetition and keep module files readable:
- Declare shared request headers at **path-item level** (`paths.<path>.parameters`) whenever all operations under that path use the same header set.
- Keep operation-level `parameters` for operation-specific items only (query/path/body-related parameters that are not shared).
- Group shared request headers with inline comments to improve scanability:
  - `# Correlation headers`: `X-Request-ID`, `X-Correlation-ID`
  - `# Routing headers`: `OCPI-from-country-code`, `OCPI-from-party-id`, `OCPI-to-country-code`, `OCPI-to-party-id`
- Keep response headers at response level (no path-level factorization in OpenAPI responses), but add grouping comments:
  - `# Correlation headers`: `X-Request-ID`, `X-Correlation-ID`
  - `# Pagination headers`: `X-Total-Count`, `X-Limit`, `Link`
- Exception: do **not** add OCPI routing headers to `versions.yaml`, `credentials.yaml`, and `hub-client-info.yaml` where those headers are not part of the functional module contract.
- Path-level request headers are merged with operation-level parameters; if an operation defines the same parameter (`name` + `in`), the operation-level value overrides the path-level one.

## Implementation Plan

### Phase 0: Baseline and gap analysis
1. Compare current 2.3.0 OpenAPI sources against:
   - `specifications/ocpi-2.3.0/*.asciidoc`
   - `openapi/ocpi-2.2.1/` structure and latest rules
2. Build a delta list:
   - missing/extra endpoints,
   - missing/duplicated schemas,
   - non-uniform header placement,
   - missing callbacks/webhooks.

### Phase 1: Foundation (`shared/`)
**Files:**
- `openapi/ocpi-2.3.0/shared/common.yaml`
- `openapi/ocpi-2.3.0/shared/headers.yaml`
- `openapi/ocpi-2.3.0/shared/parameters.yaml`
- `openapi/ocpi-2.3.0/shared/schemas/types.yaml`
- `openapi/ocpi-2.3.0/shared/schemas/locations.yaml`
- `openapi/ocpi-2.3.0/shared/schemas/tokens.yaml`
- `openapi/ocpi-2.3.0/shared/schemas/cdrs.yaml`

`common.yaml` content:
- `OcpiResponse` (generic wrapper)

`shared/schemas/types.yaml` content:
- `DateTime`, `CiString`
- `DisplayText` (language + text)
- `Price` (before_taxes + taxes)
- `TaxAmount` (name, account_number, percentage, amount)
- Shared enum: `Role`

`shared/schemas/locations.yaml` content:
- `GeoLocation`, `AdditionalGeoLocation`
- `BusinessDetails` (name, website, logo)
- `Image` (url, thumbnail, category, type, width, height)
- `Hours` (twentyfourseven, regular_hours, exceptional_openings/closings)
- `RegularHours`, `ExceptionalPeriod`
- `EnergyMix`, `EnergySource`, `EnvironmentalImpact`
- Shared enums: `ImageCategory`, `EnergySourceCategory`, `EnvironmentalImpactCategory`

`shared/schemas/tokens.yaml` content:
- `LocationReferences`, `EnergyContract`
- Shared enums: `TokenType`, `WhitelistType`, `AllowedType`

`shared/schemas/cdrs.yaml` content:
- `CdrToken`, `CdrLocation`, `ChargingPeriod`, `CdrDimension`, `SignedData`, `SignedValue`
- Shared enums: `AuthMethod`, `CdrDimensionType`

`headers.yaml` content:
- Request headers (parameters): `X-Request-ID`, `X-Correlation-ID`, `OCPI-from-*`, `OCPI-to-*`
- Response headers: `X-Request-ID`, `X-Correlation-ID`, `X-Total-Count`, `X-Limit`, `Link`
- Note: Authentication is handled via `securitySchemes` (not a header parameter)

`parameters.yaml` content:
- Pagination: `date_from`, `date_to`, `offset`, `limit`
- Client-owned resources: `country_code`, `party_id` (path params)

### Phase 2: Configuration modules
**Files:** `openapi/ocpi-2.3.0/versions.yaml`, `openapi/ocpi-2.3.0/credentials.yaml`

`versions.yaml`:
- GET /versions -> list of versions (version + url)
- GET /versions/{version} -> version details (version + endpoints[])
- Schemas: `Version`, `VersionDetails`, `Endpoint`, `VersionNumber` (open enum), `ModuleID` (open enum), `InterfaceRole`

`credentials.yaml`:
- GET /credentials -> `Credentials` object
- POST /credentials -> registration
- PUT /credentials -> credentials/version update
- DELETE /credentials -> unregister
- Schemas: `Credentials` (token, url, hub_party_id, roles[]), `CredentialsRole`

### Phase 3: Core functional modules

**`locations.yaml`** (~1,200 lines):
- Sender (CPO): GET /locations (paginated), GET /locations/{id}, GET /locations/{id}/{evse_uid}, GET /locations/{id}/{evse_uid}/{connector_id}
- Receiver (eMSP): GET/PUT/PATCH /{country_code}/{party_id}/{location_id}[/{evse_uid}[/{connector_id}]]
- Schemas: `Location`, `EVSE`, `Connector`, `Parking`, `EVSEParking`, `PublishTokenType`, `StatusSchedule`
- Enums: `Status`, `Capability`, `ConnectorType`, `ConnectorFormat`, `ConnectorCapability`, `PowerType`, `ParkingType`, `ParkingRestriction`, `ParkingDirection`, `VehicleType`, `EVSEPosition`, `Facility`

**`tariffs.yaml`** (~415 lines):
- Sender (CPO): GET /tariffs (paginated)
- Receiver (eMSP): GET/PUT/DELETE /{country_code}/{party_id}/{tariff_id}
- Schemas: `Tariff`, `TariffElement`, `PriceComponent`, `PriceLimit`, `TariffRestrictions`
- Enums: `TariffType`, `TariffDimensionType`, `DayOfWeek`, `ReservationRestrictionType`, `TaxIncluded`

**`cdrs.yaml`** (~477 lines):
- Sender (CPO): GET /cdrs (paginated)
- Receiver (eMSP): GET (by URL), POST (returns Location header)
- Schemas: `CDR`, `CdrLocation`, `CdrToken`, `ChargingPeriod`, `CdrDimension`, `SignedData`, `SignedValue`
- Enums: `AuthMethod`, `CdrDimensionType`

**`sessions.yaml`** (~376 lines):
- Sender (CPO): GET /sessions (paginated), PUT /sessions/{id}/charging_preferences
- Receiver (eMSP): GET/PUT/PATCH /{country_code}/{party_id}/{session_id}
- Schemas: `Session`, `ChargingPreferences`
- Enums: `SessionStatus`, `ProfileType`, `ChargingPreferencesResponse`

**`tokens.yaml`** (~420 lines):
- Sender (eMSP): GET /tokens (paginated), POST /tokens/{uid}/authorize
- Receiver (CPO): GET/PUT/PATCH /{country_code}/{party_id}/{token_uid}?type=
- Schemas: `Token`, `AuthorizationInfo`, `LocationReferences`, `EnergyContract`
- Enums: `TokenType` (open enum), `WhitelistType`, `AllowedType`

### Phase 4: Async modules

**`commands.yaml`** (~515 lines):
- Receiver (CPO): POST /commands/CANCEL_RESERVATION, POST /commands/RESERVE_NOW, POST /commands/START_SESSION, POST /commands/STOP_SESSION, POST /commands/UNLOCK_CONNECTOR
- OpenAPI callbacks to link POST -> `response_url` (`CommandResult`)
- OpenAPI webhooks for Sender POST (receives async `CommandResult`)
- Schemas: `CancelReservation`, `ReserveNow`, `StartSession`, `StopSession`, `UnlockConnector`, `CommandResponse`, `CommandResult`
- Enums: `CommandType`, `CommandResponseType`, `CommandResultType`

**`charging-profiles.yaml`** (~410 lines):
- Receiver (CPO): GET/PUT/DELETE /{session_id} (with `response_url`)
- Sender (eMSP/SCSP): PUT /{session_id}/activeprofile (push updates)
- OpenAPI callbacks for `ActiveChargingProfileResult`, `ChargingProfileResult`, `ClearProfileResult`
- OpenAPI webhooks for Sender POST (receives async results for all 3 result types)
- Schemas: `ChargingProfile`, `ChargingProfilePeriod`, `ActiveChargingProfile`, `SetChargingProfile`, `ChargingProfileResponse`, `ActiveChargingProfileResult`, `ChargingProfileResult`, `ClearProfileResult`
- Enums: `ChargingRateUnit`, `ChargingProfileResponseType`, `ChargingProfileResultType`

### Phase 5: Specialized modules

**`hub-client-info.yaml`** (~166 lines):
- Sender (Hub): GET /hubclientinfo (paginated)
- Receiver (Party): GET/PUT /{country_code}/{party_id}
- Schemas: `ClientInfo`
- Enums: `ConnectionStatus`

**`payments.yaml`** (~607 lines):
- Terminals Sender (PTP): GET list, GET/PUT/PATCH /{terminal_id}, POST activate, POST /{terminal_id}/deactivate
- Terminals Receiver (CPO): POST (create), GET /{terminal_id}
- FAC Sender (PTP): GET list, GET /{fac_id}
- FAC Receiver (CPO): POST (create), GET /{fac_id}
- Schemas: `Terminal`, `FinancialAdviceConfirmation`
- Enums: `InvoiceCreator`, `CaptureStatusCode`

### Phase 6: Root aggregation
Generate root file:

```bash
node tools/generate-root-openapi.js 2.3.0
```

Expected output:
- `openapi/ocpi-2.3.0/openapi.yaml`
- root `paths` `$ref` entries for each module
- root `webhooks` `$ref` entries for async modules

## Conventions

| Aspect | Convention |
|--------|------------|
| Schema names | PascalCase (`TariffElement`) |
| Property names | snake_case (`country_code`) — aligned with OCPI JSON |
| Operation IDs | camelCase (`getLocations`, `putToken`) |
| Tags | `{Module} - Sender`, `{Module} - Receiver` |
| Descriptions | Normative text copied from AsciiDoc (MUST, SHALL, SHOULD, MAY) |
| Objects | `additionalProperties: true` (OCPI extensibility) |
| Cross references | Relative `$ref` between files (for example `./tokens.yaml#/...`) |
| Authentication | `securitySchemes` only (no `Authorization` parameter). Applied via top-level `security` |
| Response headers | `X-Request-ID` and `X-Correlation-ID` appear as request parameters AND response headers |
| Async webhooks | Commands and ChargingProfiles use `webhooks` + `callbacks` to document both sides |
| Request header placement | Prefer path-level `parameters` for shared OCPI headers; keep operation-level parameters only for operation-specific fields |
| Header grouping comments | Use `# Correlation headers`, `# Routing headers`, and `# Pagination headers` to structure header blocks consistently |
| Header exceptions | `versions.yaml`, `credentials.yaml`, and `hub-client-info.yaml` do not receive OCPI routing headers by default |

## Source Files Reviewed for 2.3.0

| Source file | Used for |
|-------------|----------|
| `transport_and_format.asciidoc` | Response wrapper, pagination, headers, routing |
| `types.asciidoc` | DisplayText, Price, TaxAmount, primitive types |
| `status_codes.asciidoc` | OCPI status codes (1xxx-4xxx) |
| `version_information_endpoint.asciidoc` | Versions + version details endpoints |
| `credentials.asciidoc` | Credentials endpoint + flow |
| `mod_locations.asciidoc` | Location, EVSE, Connector, Parking + 28 types |
| `mod_sessions.asciidoc` | Session, ChargingPreferences |
| `mod_cdrs.asciidoc` | CDR, CdrLocation, CdrToken, ChargingPeriod |
| `mod_tariffs.asciidoc` | Tariff, TariffElement, PriceComponent, restrictions |
| `mod_tokens.asciidoc` | Token, AuthorizationInfo, real-time auth |
| `mod_commands.asciidoc` | 5 command types, async pattern |
| `mod_charging_profiles.asciidoc` | ChargingProfile, async pattern |
| `mod_hub_client_info.asciidoc` | ClientInfo, ConnectionStatus |
| `mod_payments.asciidoc` | Terminal, FinancialAdviceConfirmation |

## Verification

1. **Syntax validation**: each YAML file validated with `pyyaml` — 19/19 OK
2. **Example conformance**: JSON files in `examples/` can be validated against schemas
3. **Completeness**: each endpoint and type checked against the corresponding `.asciidoc` file
4. **Cross-references**: inter-file `$ref` values use relative paths
5. **Linting**: run `npx @redocly/cli lint openapi/ocpi-2.3.0/openapi.yaml` and `npx @redocly/cli lint openapi/ocpi-2.3.0/**/*.yaml`, then resolve path/parameter merge warnings
6. **Build smoke tests**: run `npm run build:redoc` and `npm run build:swagger`
7. **Bundle integrity**: run `npx @redocly/cli bundle openapi/ocpi-2.3.0/openapi.yaml -o /tmp/ocpi-2.3.0.bundle.yaml`
8. **Coverage matrix**: maintain endpoint/schema mapping from AsciiDoc sources to OpenAPI paths/components and document intentional exclusions
9. **UI parity check**: verify in Swagger UI that each operation still exposes the same effective request and response headers after path-level grouping

## 2.3.0 Guardrails (Spec Scope Discipline)

- keep Payments artifacts only in 2.3.0 plan and sources,
- keep 2.3.0 role/module enum values aligned with 2.3.0 AsciiDoc,
- avoid introducing fields/endpoints not grounded in the 2.3.0 source spec,
- document any deliberate modeling tradeoff for codegen clarity.

## Refactor Objective (Single-Pass, All 2.3.0 Modules)

This phase refactors all OCPI 2.3.0 modules in one pass with the following priority order:

1. **respect-spec-before**: schema names, semantics, and extensibility behavior MUST follow the OCPI AsciiDoc specification.
2. **codegen-first**: resulting OpenAPI MUST remain stable and reusable for SDK generation.

### Rules for this pass

- Refactor all modules together (`versions`, `credentials`, `locations`, `sessions`, `cdrs`, `tariffs`, `tokens`, `commands`, `charging-profiles`, `hub-client-info`, `payments`).
- Keep module-level root objects (for example `CDR`, `Session`, `Token`, `Tariff`) where they represent module contracts.
- Move only truly shared classes/enums to `shared/schemas/*` and reference them from modules.
- Remove duplicated local definitions once shared refs are in place (single source of truth per shared schema).
- Replace repeated inline response envelopes (`allOf + data`) with named reusable response schemas/components.
- Keep OCPI extensibility with `additionalProperties: true` for objects where required by spec.
- Keep open/extensible enums when the spec allows custom values, using:

```yaml
anyOf:
  - type: string
    enum: [KNOWN_VALUE_1, KNOWN_VALUE_2]
  - type: string
```

### Acceptance criteria

- No duplicated shared schema definitions across module files.
- Shared schema refs are visible and reused across modules.
- Response wrappers are named and reused instead of repeated anonymous route-level wrappers for the same payload shape.
- Source module files apply header grouping uniformly: no duplicated common OCPI request headers at operation level.
- `npm run build:redoc` and `npm run build:swagger` both succeed.
- Bundled spec remains complete for all modules and preserves OCPI semantics.

## Model Generation Rules (Spec-First, Codegen-Ready)

These rules apply to schema naming and response modeling for all modules.

### Naming policy

- Keep OCPI specification names exactly when defined by spec text (for example `CDR`, `CdrToken`, `CdrLocation`, `CdrDimension`).
- Do not normalize spec names for cosmetic consistency in source OpenAPI (for example do not rename `CDR` to `Cdr`).
- If consumers need naming normalization, handle it in SDK generator configuration/mapping, not in the OpenAPI source.

### Response model policy

- Use named response schemas for all typed payloads:
  - single item: `<Entity>Response`
  - collection: `<Entity>ListResponse`
- `ListResponse` MUST define `data` directly as `type: array` with `items` referencing the entity schema.
- Do not introduce intermediate `*ListData` schemas unless there is a concrete reuse need across multiple schemas.
- `Response` schemas SHOULD be explicit objects (`type: object`) with `status_code`, `status_message`, `timestamp`, and typed `data` to improve code generation clarity.

### PUT/PATCH request model policy

- PUT request bodies MUST reference named full-object schemas (no anonymous free-form objects).
- PATCH request bodies MUST reference named `*Patch` schemas (no anonymous free-form objects).
- For PATCH, fields omitted from payload are considered unchanged.
- PATCH schemas MUST keep `additionalProperties: true` for OCPI extensibility, while still defining known properties explicitly.
- When OCPI explicitly requires it, `last_updated` MUST be required in `*Patch` schemas (Locations, Sessions, Tokens).
- For Payments Terminal PATCH, model assignment payload (`location_ids` and/or `evse_uids`) as defined by spec and do not add non-specified mandatory fields.
- PUT/PATCH request bodies SHOULD include realistic examples derived from OCPI specification examples.

### Swagger/UI bundling policy

- Build Swagger bundles with Redocly CLI bundle to preserve named reusable schemas in output.
- Keep Swagger UI models panel visible (`defaultModelsExpandDepth` >= 0) to make shared model references inspectable.

## Header Grouping Migration Steps

1. For each functional module, identify paths where all operations share the same 6 OCPI request headers.
2. Move those 6 header `$ref` to `paths.<path>.parameters` with grouped comments:
   - `# Correlation headers`
   - `# Routing headers`
3. Keep only operation-specific parameters at operation level.
4. For configuration modules (`versions`, `credentials`, `hub-client-info`), keep only correlation headers unless the spec explicitly requires routing headers.
5. Keep response headers at response level with grouped comments:
   - `# Correlation headers`
   - `# Pagination headers`
6. Validate with `npx @redocly/cli lint`.
7. Verify in Swagger UI that each operation still exposes the same effective headers.

## Deliverables

1. Updated plan aligned with latest OpenAPI rules for 2.3.0.
2. Refreshed OpenAPI sources under `openapi/ocpi-2.3.0/` with shared schema split.
3. Generated root file `openapi/ocpi-2.3.0/openapi.yaml`.
4. Endpoint + schema coverage matrix (`specifications/ocpi-2.3.0/*.asciidoc` -> `openapi/ocpi-2.3.0/**/*.yaml`).
5. Lint/build/bundle verification evidence and any residual warning rationale.
