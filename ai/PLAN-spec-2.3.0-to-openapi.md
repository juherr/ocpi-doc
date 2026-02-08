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
│   ├── common.yaml            # Shared types (DisplayText, Price, GeoLocation, etc.)
│   ├── headers.yaml           # Common headers (Auth, X-Request-ID, routing, pagination)
│   └── parameters.yaml        # Reusable parameters (pagination, country_code, party_id)
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
Every OCPI response is wrapped in `{data, status_code, status_message, timestamp}`. We define a generic `OcpiResponse` schema in `shared/common.yaml`, then create typed endpoint variants using `allOf`.

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
Use OpenAPI 3.1.0 `callbacks` to document POST requests to `response_url`.

### OCPI extensibility
All objects use `additionalProperties: true` (OCPI forbids rejecting unknown fields).

## Implementation Plan

### Phase 1: Foundation (`shared/`)
**Files:** `openapi/shared/common.yaml`, `headers.yaml`, `parameters.yaml`

`common.yaml` content:
- `OcpiResponse` (generic wrapper)
- `DisplayText` (language + text)
- `Price` (before_taxes + taxes)
- `TaxAmount` (name, account_number, percentage, amount)
- `GeoLocation` (latitude, longitude)
- `AdditionalGeoLocation`
- `BusinessDetails` (name, website, logo)
- `Image` (url, thumbnail, category, type, width, height)
- `Hours` (twentyfourseven, regular_hours, exceptional_openings/closings)
- `RegularHours`, `ExceptionalPeriod`
- `EnergyMix`, `EnergySource`, `EnvironmentalImpact`
- Shared enums: `Role`, `ImageCategory`, `EnergySourceCategory`, `EnvironmentalImpactCategory`

`headers.yaml` content:
- Request headers: `Authorization`, `X-Request-ID`, `X-Correlation-ID`, `OCPI-from-*`, `OCPI-to-*`
- Response headers: `X-Total-Count`, `X-Limit`, `Link`

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
- Schemas: `CancelReservation`, `ReserveNow`, `StartSession`, `StopSession`, `UnlockConnector`, `CommandResponse`, `CommandResult`
- Enums: `CommandType`, `CommandResponseType`, `CommandResultType`

**`charging-profiles.yaml`** (~410 lines):
- Receiver (CPO): GET/PUT/DELETE /{session_id} (with `response_url`)
- Sender (eMSP/SCSP): PUT /{session_id}/activeprofile (push updates)
- OpenAPI callbacks for `ActiveChargingProfileResult`, `ChargingProfileResult`, `ClearProfileResult`
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
