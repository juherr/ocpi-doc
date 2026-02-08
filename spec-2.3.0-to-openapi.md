# Plan : Génération de fichiers OpenAPI pour OCPI 2.3.0

## Contexte

Le dépôt OCPI contient la spécification du protocole (en AsciiDoc) mais pas de fichier OpenAPI, ce qui complique l'implémentation pour les développeurs. L'objectif est de créer des fichiers OpenAPI 3.1.0 couvrant l'intégralité du protocole OCPI 2.3.0 : 11 modules, ~100 types/enums, ~50 endpoints.

## Décisions de design

### OpenAPI 3.1.0 (YAML)
- Compatible JSON Schema 2020-12 (meilleure modélisation des types complexes)
- Support natif de `null`, `const`, `anyOf` pour les OpenEnums
- Feature `callbacks` pour les patterns async (Commands, ChargingProfiles)
- YAML : plus lisible que JSON pour un spec de cette taille

### Structure multi-fichiers : 1 fichier par module + composants partagés
Un bon compromis entre maintenabilité et facilité d'utilisation.

```
openapi/
├── shared/
│   ├── common.yaml           # Types partagés (DisplayText, Price, GeoLocation, etc.)
│   ├── headers.yaml           # Headers communs (Auth, X-Request-ID, routing, pagination)
│   └── parameters.yaml        # Paramètres réutilisables (pagination, country_code, party_id)
├── versions.yaml              # Module Versions (GET versions, GET version details)
├── credentials.yaml           # Module Credentials (GET, POST, PUT, DELETE)
├── locations.yaml             # Module Locations (Sender + Receiver, tags séparés)
├── sessions.yaml              # Module Sessions + ChargingPreferences
├── cdrs.yaml                  # Module CDRs
├── tariffs.yaml               # Module Tariffs
├── tokens.yaml                # Module Tokens + Real-time Authorization
├── commands.yaml              # Module Commands (async callbacks)
├── charging-profiles.yaml      # Module ChargingProfiles (async callbacks)
├── hub-client-info.yaml         # Module Hub Client Info
└── payments.yaml              # Module Payments (Terminals + FAC)
```

**Total : 14 fichiers (~5 600 lignes YAML)**

### Sender vs Receiver dans le même fichier
Chaque fichier module contient les deux interfaces (Sender et Receiver) séparées par des tags OpenAPI (`Locations - Sender`, `Locations - Receiver`). Cela permet :
- Moins de fichiers à gérer (14 au lieu de ~25)
- Les schemas sont colocalisés avec les endpoints qui les utilisent
- Les outils de code generation peuvent filtrer par tag

### Pattern pour l'enveloppe OCPI Response
Chaque réponse OCPI est wrappée dans `{data, status_code, status_message, timestamp}`. On définit un schema `OcpiResponse` générique dans `shared/common.yaml`, et des variantes typées par endpoint via `allOf`.

### OpenEnums (enums extensibles)
Modélisés avec `anyOf` :
```yaml
ConnectorType:
  anyOf:
    - type: string
      enum: [CHADEMO, IEC_62196_T2, ...]  # Valeurs connues
    - type: string                          # Valeurs custom autorisées
```

### Patterns async (Commands, ChargingProfiles)
Utilisation de la feature `callbacks` d'OpenAPI 3.1.0 pour documenter le POST vers `response_url`.

### Extensibilité OCPI
Tous les objets ont `additionalProperties: true` (OCPI interdit de rejeter les champs inconnus).

## Plan d'implémentation

### Phase 1 : Fondation (`shared/`)
**Fichiers :** `openapi/shared/common.yaml`, `headers.yaml`, `parameters.yaml`

Contenu de `common.yaml` :
- `OcpiResponse` (wrapper générique)
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
- Enums partagés : `Role`, `ImageCategory`, `EnergySourceCategory`, `EnvironmentalImpactCategory`

Contenu de `headers.yaml` :
- Headers de requête : `Authorization`, `X-Request-ID`, `X-Correlation-ID`, `OCPI-from-*`, `OCPI-to-*`
- Headers de réponse : `X-Total-Count`, `X-Limit`, `Link`

Contenu de `parameters.yaml` :
- Pagination : `date_from`, `date_to`, `offset`, `limit`
- Client-owned : `country_code`, `party_id` (path params)

### Phase 2 : Modules de configuration
**Fichiers :** `openapi/versions.yaml`, `openapi/credentials.yaml`

`versions.yaml` :
- GET /versions → Liste de Version (version + url)
- GET /versions/{version} → VersionDetails (version + endpoints[])
- Schemas : Version, VersionDetails, Endpoint, VersionNumber (OpenEnum), ModuleID (OpenEnum), InterfaceRole

`credentials.yaml` :
- GET /credentials → Credentials object
- POST /credentials → Registration
- PUT /credentials → Update credentials/version
- DELETE /credentials → Unregister
- Schemas : Credentials (token, url, hub_party_id, roles[]), CredentialsRole

### Phase 3 : Modules fonctionnels principaux

**`locations.yaml`** (~1 200 lignes) :
- Sender (CPO) : GET /locations (paginated), GET /locations/{id}, GET /locations/{id}/{evse_uid}, GET /locations/{id}/{evse_uid}/{connector_id}
- Receiver (eMSP) : GET/PUT/PATCH /{country_code}/{party_id}/{location_id}[/{evse_uid}[/{connector_id}]]
- Schemas : Location, EVSE, Connector, Parking, EVSEParking, PublishTokenType, StatusSchedule
- Enums : Status, Capability, ConnectorType, ConnectorFormat, ConnectorCapability, PowerType, ParkingType, ParkingRestriction, ParkingDirection, VehicleType, EVSEPosition, Facility

**`tariffs.yaml`** (~415 lignes) :
- Sender (CPO) : GET /tariffs (paginated)
- Receiver (eMSP) : GET/PUT/DELETE /{country_code}/{party_id}/{tariff_id}
- Schemas : Tariff, TariffElement, PriceComponent, PriceLimit, TariffRestrictions
- Enums : TariffType, TariffDimensionType, DayOfWeek, ReservationRestrictionType, TaxIncluded

**`cdrs.yaml`** (~477 lignes) :
- Sender (CPO) : GET /cdrs (paginated)
- Receiver (eMSP) : GET (by URL), POST (returns Location header)
- Schemas : CDR, CdrLocation, CdrToken, ChargingPeriod, CdrDimension, SignedData, SignedValue
- Enums : AuthMethod, CdrDimensionType

**`sessions.yaml`** (~376 lignes) :
- Sender (CPO) : GET /sessions (paginated), PUT /sessions/{id}/charging_preferences
- Receiver (eMSP) : GET/PUT/PATCH /{country_code}/{party_id}/{session_id}
- Schemas : Session, ChargingPreferences
- Enums : SessionStatus, ProfileType, ChargingPreferencesResponse

**`tokens.yaml`** (~420 lignes) :
- Sender (eMSP) : GET /tokens (paginated), POST /tokens/{uid}/authorize
- Receiver (CPO) : GET/PUT/PATCH /{country_code}/{party_id}/{token_uid}?type=
- Schemas : Token, AuthorizationInfo, LocationReferences, EnergyContract
- Enums : TokenType (OpenEnum), WhitelistType, AllowedType

### Phase 4 : Modules async

**`commands.yaml`** (~515 lignes) :
- Receiver (CPO) : POST /commands/CANCEL_RESERVATION, POST /commands/RESERVE_NOW, POST /commands/START_SESSION, POST /commands/STOP_SESSION, POST /commands/UNLOCK_CONNECTOR
- Callbacks OpenAPI pour lier POST → response_url (CommandResult)
- Schemas : CancelReservation, ReserveNow, StartSession, StopSession, UnlockConnector, CommandResponse, CommandResult
- Enums : CommandType, CommandResponseType, CommandResultType

**`charging-profiles.yaml`** (~410 lignes) :
- Receiver (CPO) : GET/PUT/DELETE /{session_id} (avec response_url)
- Sender (eMSP/SCSP) : PUT /{session_id}/activeprofile (push updates)
- Callbacks OpenAPI pour ActiveChargingProfileResult, ChargingProfileResult, ClearProfileResult
- Schemas : ChargingProfile, ChargingProfilePeriod, ActiveChargingProfile, SetChargingProfile, ChargingProfileResponse, ActiveChargingProfileResult, ChargingProfileResult, ClearProfileResult
- Enums : ChargingRateUnit, ChargingProfileResponseType, ChargingProfileResultType

### Phase 5 : Modules spécialisés

**`hub-client-info.yaml`** (~166 lignes) :
- Sender (Hub) : GET /hubclientinfo (paginated)
- Receiver (Party) : GET/PUT /{country_code}/{party_id}
- Schemas : ClientInfo
- Enums : ConnectionStatus

**`payments.yaml`** (~607 lignes) :
- Terminals Sender (PTP) : GET list, GET/PUT/PATCH /{terminal_id}, POST activate, POST /{terminal_id}/deactivate
- Terminals Receiver (CPO) : POST (create), GET /{terminal_id}
- FAC Sender (PTP) : GET list, GET /{fac_id}
- FAC Receiver (CPO) : POST (create), GET /{fac_id}
- Schemas : Terminal, FinancialAdviceConfirmation
- Enums : InvoiceCreator, CaptureStatusCode

## Conventions

| Aspect | Convention |
|--------|-----------|
| Noms de schemas | PascalCase (`TariffElement`) |
| Noms de propriétés | snake_case (`country_code`) — conforme au JSON OCPI |
| Operation IDs | camelCase (`getLocations`, `putToken`) |
| Tags | `{Module} - Sender`, `{Module} - Receiver` |
| Descriptions | Texte normatif copié de l'AsciiDoc (MUST, SHALL, SHOULD, MAY) |
| Objets | `additionalProperties: true` (extensibilité OCPI) |
| Références croisées | `$ref` relatifs entre fichiers (e.g. `./tokens.yaml#/...`) |

## Fichiers source consultés

| Fichier source | Pour |
|----------------|------|
| `transport_and_format.asciidoc` | Response wrapper, pagination, headers, routing |
| `types.asciidoc` | DisplayText, Price, TaxAmount, types primitifs |
| `status_codes.asciidoc` | Codes OCPI (1xxx-4xxx) |
| `version_information_endpoint.asciidoc` | Versions + Version details endpoints |
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

## Vérification

1. **Validation syntaxique** : Chaque fichier YAML validé avec `pyyaml` — 14/14 OK
2. **Conformité des exemples** : Les fichiers JSON dans `examples/` peuvent être vérifiés contre les schemas
3. **Complétude** : Chaque endpoint et chaque type vérifié par rapport au fichier `.asciidoc` correspondant
4. **Cross-références** : Les `$ref` entre fichiers utilisent des chemins relatifs
