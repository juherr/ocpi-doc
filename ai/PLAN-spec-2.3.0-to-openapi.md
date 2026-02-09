# Plan: Generate OpenAPI Files for OCPI 2.3.0

## Context

The OCPI repository includes the protocol specification (AsciiDoc) but no OpenAPI files, which makes implementation harder for developers. The goal is to create OpenAPI 3.1.0 files that fully cover OCPI 2.3.0: 11 modules, ~100 types/enums, and ~50 endpoints.

## Design Decisions

### OpenAPI 3.1.0 (YAML)
- Compatible with JSON Schema 2020-12 (better modeling of complex types)
- Native support for `null`, `const`, and `anyOf` for open enums
- `callbacks` support for async patterns (Commands, ChargingProfiles)
- YAML is more readable than JSON for a spec of this size

### Multi-file structure: one file per module + shared components
A good balance between maintainability and ease of use.

```
openapi/
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
└── payments.yaml              # Payments module (Terminals + FAC)
```

**Total: 14 files (~5,600 YAML lines)**

### Sender vs Receiver in the same file
Each module file contains both interfaces (Sender and Receiver), separated by OpenAPI tags (`Locations - Sender`, `Locations - Receiver`). This provides:
- Fewer files to manage (14 instead of ~25)
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
specification for implementers.

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
- Exception: do **not** add OCPI routing headers to `versions.yaml` and `credentials.yaml` where those headers are not part of the functional module contract.
- Path-level request headers are merged with operation-level parameters; if an operation defines the same parameter (`name` + `in`), the operation-level value overrides the path-level one.

## Implementation Plan

### Phase 1: Foundation (`shared/`)
**Files:**
- `openapi/shared/common.yaml`
- `openapi/shared/headers.yaml`
- `openapi/shared/parameters.yaml`
- `openapi/shared/schemas/types.yaml`
- `openapi/shared/schemas/locations.yaml`
- `openapi/shared/schemas/tokens.yaml`
- `openapi/shared/schemas/cdrs.yaml`

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
**Files:** `openapi/versions.yaml`, `openapi/credentials.yaml`

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
| Header exceptions | `versions.yaml` and `credentials.yaml` do not receive OCPI routing headers by default |

## Source Files Reviewed

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

1. **Syntax validation**: each YAML file validated with `pyyaml` — 14/14 OK
2. **Example conformance**: JSON files in `examples/` can be validated against schemas
3. **Completeness**: each endpoint and type checked against the corresponding `.asciidoc` file
4. **Cross-references**: inter-file `$ref` values use relative paths
5. **Linting**: run `npx @redocly/cli lint openapi/**/*.yaml` and resolve path/parameter merge warnings
6. **UI parity check**: verify in Swagger UI that each operation still exposes the same effective request and response headers after path-level grouping

## Current Refactor Objective (Single-Pass, All Modules)

This phase refactors all OCPI 2.3.0 modules in one pass with the following priority order:

1. **respect-spec-before**: schema names, semantics, and extensibility behavior MUST follow the OCPI AsciiDoc specification.
2. **codegen-first**: resulting OpenAPI MUST remain stable and reusable for SDK generation.

### Rules for this phase

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

### Acceptance criteria for this phase

- No duplicated shared schema definitions across module files.
- Shared schema refs are visible and reused across modules.
- Response wrappers are named and reused instead of repeated anonymous route-level wrappers for the same payload shape.
- Source module files apply header grouping uniformly: no duplicated common OCPI request headers at operation level.
- `npm run build:redoc` and `npm run build:swagger` both succeed.
- Bundled spec remains complete for all modules and preserves OCPI semantics.

## Model generation rules (spec-first, codegen-ready)

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

## Header grouping migration steps

1. For each module, identify paths where all operations share the same 6 OCPI request headers.
2. Move those 6 header `$ref` to `paths.<path>.parameters` with grouped comments:
   - `# Correlation headers`
   - `# Routing headers`
3. Keep only operation-specific parameters at operation level.
4. Keep response headers at response level with grouped comments:
   - `# Correlation headers`
   - `# Pagination headers`
5. Validate with `npx @redocly/cli lint`.
6. Verify in Swagger UI that each operation still exposes the same effective headers.
