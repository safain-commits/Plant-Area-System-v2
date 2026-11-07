# Graph Report - plant-area-system  (2026-11-07)

## Corpus Check
- 256 files · ~171,366 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: (none) 11, .css 11, .conf 3)

## Summary
- 1493 nodes · 3907 edges · 116 communities (77 shown, 39 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.86)
- Token cost unavailable. The host's subagent tools do not expose measured token usage. The numeric zeros in cost.json are placeholders, not measured usage.

## Community Hubs (Navigation)
- Shared Errors and Stock Transactions
- Bag Access Integration Tests
- Consumable Order Carts
- Shared Domain Contracts
- Consumables Workspace Controls
- Cross Application Acceptance Tests
- Dashboard Summary Components
- Database Migration Execution
- Overlay Gesture Navigation
- Authenticated Application Pages
- Repository Automation Scripts
- Auth Application Dependencies
- Bag Position Selection
- Bag Application Dependencies
- Consumables Application Dependencies
- Portal Application Dependencies
- Authentication Data Core
- Runtime Dependency Catalog
- Administration Workspace Controls
- Consumables Inventory Schema
- Application Theme Layouts
- Bag Monitoring Inputs
- User Administration Services
- Compose Runtime Services
- Product Operations Documentation
- Product Operations Documentation
- Database Migration Containers
- Consumables Core Dependencies
- UI Design Token System
- Database Environment Configuration
- Continuous Integration Validation
- Auth Core Dependencies
- Shared TypeScript Configuration
- Gateway Identity Verification
- Compose Application Dependencies
- Development Tool Dependencies
- Bag Core Dependencies
- Workspace Account Flows
- Shared UI Dependencies
- Brand Artwork Generation
- Nginx Service Routing
- Product Operations Documentation
- Cross Application UI Design
- Database Snapshot Verification
- Local Development Setup
- Workspace Account Flows
- Service Authentication Configuration
- MySQL Credential Configuration
- Authentication Storage Schema
- Authentication Data Core
- Container Health Checks
- Server Package Dependencies
- Cross Application Acceptance Tests
- Next Application Build Configuration
- Auth TypeScript Configuration
- Bag TypeScript Configuration
- Consumables TypeScript Configuration
- Portal TypeScript Configuration
- Container Build Arguments
- User Administration Services
- Product Operations Documentation
- Bag Installation Storage
- Domain Contract Dependencies
- Gateway Recovery Verification
- Bag Operational Insights
- Development Smoke Verification
- Consumables Workflow Acceptance Tests
- Authenticated Application Pages
- Authenticated Application Pages
- Database Test Infrastructure
- Database Test Infrastructure
- Bag Bulk Selection Tests
- Bag Filter Container
- Consumables Application Container
- Drizzle Migration Tooling
- Brand Artwork Components
- Workspace Build Permissions
- Source Formatting Configuration
- Product Operations Documentation
- Consumables Liveness Endpoint
- Portal Readiness Endpoint
- Application Brand Symbol
- Application Brand Symbol
- Application Brand Symbol
- Application Brand Symbol
- Expanded Brand Wordmark
- Compact Brand Symbol
- TLS Certificate Setup
- Database Backup Shell
- Database Initialization Shell
- Node Engine Constraints
- Auth Migration Checkpoints
- Bag Migration Checkpoints
- Batch Cancellation Migration

## God Nodes (most connected - your core abstractions)
1. `AppError` - 91 edges
2. `BagMonitor()` - 49 edges
3. `Identity` - 38 edges
4. `Button()` - 37 edges
5. `Icon()` - 35 edges
6. `Overlay()` - 34 edges
7. `getAuthDb()` - 32 edges
8. `canConsume()` - 32 edges
9. `Input()` - 31 edges
10. `OrderCart()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `compose()` --indirect_call--> `project()`  [AMBIGUOUS]
  scripts/dev.ts → packages/ui/src/gesture.ts
- `setup()` --indirect_call--> `project()`  [AMBIGUOUS]
  scripts/dev.ts → packages/ui/src/gesture.ts
- `verifyIsolatedRuntime()` --indirect_call--> `project()`  [AMBIGUOUS]
  scripts/smoke-dev.ts → packages/ui/src/gesture.ts
- `POST()` --calls--> `AppError`  [EXTRACTED]
  apps/auth/app/api/[...all]/route.ts → packages/contracts/src/index.ts
- `GET()` --calls--> `AppError`  [EXTRACTED]
  apps/auth/app/internal/verify/route.ts → packages/contracts/src/index.ts

## Import Cycles
- 2-file cycle: `packages/contracts/src/consumables.ts -> packages/contracts/src/index.ts -> packages/contracts/src/consumables.ts`

## Hyperedges (group relationships)
- **Cross-application UI modernization** — docs_design_ui_audit_portal_consumables_operational_hub, docs_design_ui_audit_portal_consumables_reversible_overlays, docs_design_ui_audit_portal_consumables_accessible_design_tokens, docs_design_ui_audit_portal_consumables_shell_skeleton, docs_design_ui_audit_portal_consumables_stock_query_feedback, docs_design_ui_audit_portal_consumables_reversible_cart [EXTRACTED 1.00]

## Communities (116 total, 39 thin omitted)

### Community 0 - "Shared Errors and Stock Transactions"
Cohesion: 0.05
Nodes (108): Context, dynamic, GET(), json(), mutate(), PATCH, POST, dynamic (+100 more)

### Community 1 - "Bag Access Integration Tests"
Cohesion: 0.10
Nodes (44): Context, dynamic, GET(), json(), POST(), dynamic, GET(), CancellationColumns (+36 more)

### Community 2 - "Consumable Order Carts"
Cohesion: 0.14
Nodes (42): AddToOrder(), MaterialSearch(), OrderCart(), submit(), Picklist(), submit(), QuantityDialog(), stockApi() (+34 more)

### Community 3 - "Shared Domain Contracts"
Cohesion: 0.08
Nodes (41): activeAgeSummary(), BatchCancellationDialog(), BatchRecord, CancellationNotice(), CoordinateHistory(), TimelineItem, save(), Batch (+33 more)

### Community 4 - "Consumables Workspace Controls"
Cohesion: 0.13
Nodes (34): AliasInput(), Loading(), descriptions, dynamic, Page(), titles, StockHistory(), open() (+26 more)

### Community 5 - "Cross Application Acceptance Tests"
Cohesion: 0.10
Nodes (11): closeAuthDb(), authSchema, equipmentCodes, Identity, @playwright/test, paths, users, layouts (+3 more)

### Community 6 - "Dashboard Summary Components"
Cohesion: 0.13
Nodes (25): StockDashboard, ApplicationSummary(), countScale(), AnimatedNumber(), brandColors, Dashboard(), Data, n() (+17 more)

### Community 7 - "Database Migration Execution"
Cohesion: 0.12
Nodes (13): seedEquipment(), R22_ROOM_ID, equipmentPositions(), migrateConsumablesCatalog(), provision(), provisionConsumables(), preflightSingleRoom(), equipmentMigrationId (+5 more)

### Community 8 - "Overlay Gesture Navigation"
Cohesion: 0.17
Nodes (21): Confirmation, ConfirmationOptions, ConfirmationProvider(), ConfirmFunction, DateTimeField(), TimeColumn(), project(), record() (+13 more)

### Community 9 - "Authenticated Application Pages"
Cohesion: 0.14
Nodes (22): BagFilter(), dynamic, dynamic, Page(), Admin(), dynamic, dynamic, Portal() (+14 more)

### Community 10 - "Repository Automation Scripts"
Cohesion: 0.08
Nodes (26): scripts, bootstrap, brand:generate, build, check:export, consumables:import, consumables:import-naming, consumables:preflight (+18 more)

### Community 11 - "Auth Application Dependencies"
Cohesion: 0.10
Nodes (24): dependencies, next@16.4.2, @plant/auth-core@workspace:*, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1 (+16 more)

### Community 12 - "Bag Position Selection"
Cohesion: 0.21
Nodes (21): BulkSelection(), BulkSelectionForm(), Props, areaPositions(), BagArea, Compartment, compartmentChoices(), compartmentOptions() (+13 more)

### Community 13 - "Bag Application Dependencies"
Cohesion: 0.10
Nodes (24): dependencies, next@16.4.2, @plant/bag-core@workspace:*, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1 (+16 more)

### Community 14 - "Consumables Application Dependencies"
Cohesion: 0.10
Nodes (24): dependencies, next@16.4.2, @plant/consumables-core@workspace:*, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1 (+16 more)

### Community 15 - "Portal Application Dependencies"
Cohesion: 0.11
Nodes (22): dependencies, next@16.4.2, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1, next (+14 more)

### Community 16 - "Authentication Data Core"
Cohesion: 0.15
Nodes (14): dynamic, POST(), dynamic, GET(), buildAuth(), getAuth(), publicOrigin(), cache (+6 more)

### Community 17 - "Runtime Dependency Catalog"
Cohesion: 0.13
Nodes (21): dependencies, better-auth@1.7.12, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/auth-core@workspace:*, @plant/bag-core@workspace:*, @plant/consumables-core@workspace:*, @plant/contracts@workspace:* (+13 more)

### Community 18 - "Administration Workspace Controls"
Cohesion: 0.17
Nodes (13): Application, Applications(), AdminWorkspace(), act(), ConsumablesAccess(), ManagedUser, send(), UserRow() (+5 more)

### Community 19 - "Consumables Inventory Schema"
Cohesion: 0.18
Nodes (19): `catalog_imports`, `consumables_audit`, consumables_audit_time_idx, `inventory`, inventory_location_idx, `locations`, material_category_idx, `materials` (+11 more)

### Community 20 - "Application Theme Layouts"
Cohesion: 0.21
Nodes (11): Layout(), metadata, Layout(), metadata, Layout(), metadata, Layout(), metadata (+3 more)

### Community 21 - "Bag Monitoring Inputs"
Cohesion: 0.18
Nodes (15): BagMonitor(), addPositions(), cellKey(), dismiss(), focus(), hover(), keyboard(), leaveHover() (+7 more)

### Community 22 - "User Administration Services"
Cohesion: 0.30
Nodes (18): Context, dynamic, GET(), POST(), getAuthDb(), auditEntry(), authAudit(), decodeGrant() (+10 more)

### Community 23 - "Compose Runtime Services"
Cohesion: 0.11
Nodes (17): image, init, networks, restart, name, networks, gateway, private (+9 more)

### Community 24 - "Product Operations Documentation"
Cohesion: 0.16
Nodes (18): Audit baseline Plant Area System, Legacy Vinext Cloudflare D1 export, Consumable Room v1.1 R22, Fixed point atomic stock documents, Picklist K3 auto enrollment, Prompt revisi alur bisnis R22, Warehouse R22 Client material flow, Handover OpenClaw update R22 (+10 more)

### Community 25 - "Product Operations Documentation"
Cohesion: 0.23
Nodes (18): Panduan pembatalan record Bag Filter, Setup development MacBook, Native Mac development setup, Migrasi database lokal ke VPS, Single writer database cutover, Pengembangan lokal sampai pembaruan VPS, Handover OpenClaw database, Database migration checkpoints M0 M8 (+10 more)

### Community 26 - "Database Migration Containers"
Cohesion: 0.12
Nodes (17): depends_on, entrypoint, environment, image, networks, restart, volumes, mysql (+9 more)

### Community 27 - "Consumables Core Dependencies"
Cohesion: 0.15
Nodes (16): dependencies, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/contracts@workspace:*, zod@4.5.4, exports, ./import, ./schema (+8 more)

### Community 28 - "UI Design Token System"
Cohesion: 0.24
Nodes (16): Bag age color scale, Brand color aliases, Design system cascade layers, Chart hatch patterns, Theme aware chart series, Component radius tokens, Higher contrast token overrides, Dark theme semantic overrides (+8 more)

### Community 29 - "Database Environment Configuration"
Cohesion: 0.17
Nodes (16): command, environment, image, networks, profiles, AUTH_DATABASE_URL, AUTH_MIGRATION_DATABASE_URL, BAG_DATABASE_URL (+8 more)

### Community 30 - "Continuous Integration Validation"
Cohesion: 0.12
Nodes (15): jobs, validate, name, on, permissions, contents, if, name (+7 more)

### Community 31 - "Auth Core Dependencies"
Cohesion: 0.16
Nodes (15): dependencies, better-auth@1.7.12, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/contracts@workspace:*, exports, ./schema, better-auth (+7 more)

### Community 32 - "Shared TypeScript Configuration"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+7 more)

### Community 33 - "Gateway Identity Verification"
Cohesion: 0.27
Nodes (10): dynamic, GET(), dynamic, GET(), dynamic, EquipmentPage(), POST(), hasPermission() (+2 more)

### Community 34 - "Compose Application Dependencies"
Cohesion: 0.15
Nodes (14): condition, depends_on, depends_on, depends_on, depends_on, auth, migrate, condition (+6 more)

### Community 35 - "Development Tool Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @playwright/test@1.64.1, prettier@3.9.10, tsx@4.23.15, @types/node@22.19.19, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3 (+6 more)

### Community 36 - "Bag Core Dependencies"
Cohesion: 0.18
Nodes (13): dependencies, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/contracts@workspace:*, exports, ./schema, drizzle-orm, mysql2 (+5 more)

### Community 37 - "Workspace Account Flows"
Cohesion: 0.19
Nodes (11): Movement, StockDocument, stockDocumentLabels, LogoutButton(), clearR22Carts(), App, Item, NavigationTree() (+3 more)

### Community 38 - "Shared UI Dependencies"
Cohesion: 0.18
Nodes (13): dependencies, @plant/contracts@workspace:*, react@19.3.1, react-dom@19.3.1, exports, ./styles.css, @plant/contracts, react (+5 more)

### Community 39 - "Brand Artwork Generation"
Cohesion: 0.14
Nodes (7): verifier, [full, compact], outputs, revision, root, sources, extra

### Community 40 - "Nginx Service Routing"
Cohesion: 0.15
Nodes (13): condition, condition, bag-filter, consumables, portal, depends_on, image, networks (+5 more)

### Community 41 - "Product Operations Documentation"
Cohesion: 0.15
Nodes (13): Kontrak API v2, Idempotent Bag Filter batches, R22 document API, Session identity and exact origin, Whole batch cancellation, HAC SAC and mandatory Cost Center, R22 single shared stock, R22 single room preflight (+5 more)

### Community 42 - "Cross Application UI Design"
Cohesion: 0.18
Nodes (11): Accessible design tokens, Portal and Consumables UI audit, Momentum-aware drawer gestures, Portal operational hub, Reversible cart feedback, ShellSkeleton navigation fallback, Bag age map and selection, UI Refresh Brief v2 (+3 more)

### Community 43 - "Database Snapshot Verification"
Cohesion: 0.21
Nodes (11): args, capture(), compare(), databases, ephemeral, identifier(), migrationsHash(), walk() (+3 more)

### Community 44 - "Local Development Setup"
Cohesion: 0.31
Nodes (12): apps, compose(), cores, docker(), execute(), exists(), localEngine(), profile() (+4 more)

### Community 45 - "Workspace Account Flows"
Cohesion: 0.36
Nodes (9): ChangePassword(), dynamic, LoginForm(), PasswordForm(), dynamic, Login(), safeReturnTo(), BrandLogo() (+1 more)

### Community 46 - "Service Authentication Configuration"
Cohesion: 0.36
Nodes (12): environment, environment, environment, AUTH_INTERNAL_URL, AUTH_SECRET, NGINX_ENVSUBST_FILTER, NODE_ENV, PUBLIC_ORIGIN (+4 more)

### Community 47 - "MySQL Credential Configuration"
Cohesion: 0.17
Nodes (12): AUTH_DB_PASSWORD, BAG_DB_PASSWORD, CONSUMABLES_DB_PASSWORD, MYSQL_ROOT_HOST, MYSQL_ROOT_PASSWORD, command, environment, image (+4 more)

### Community 48 - "Authentication Storage Schema"
Cohesion: 0.27
Nodes (11): account_user_idx, `accounts`, `app_grants`, `applications`, `auth_audit`, auth_audit_time_idx, `login_attempts`, session_user_idx (+3 more)

### Community 49 - "Authentication Data Core"
Cohesion: 0.27
Nodes (10): account, applications, audit, dataMigrations, grants, loginAttempts, session, user (+2 more)

### Community 50 - "Container Health Checks"
Cohesion: 0.55
Nodes (11): healthcheck, healthcheck, healthcheck, interval, retries, start_period, test, timeout (+3 more)

### Community 51 - "Server Package Dependencies"
Cohesion: 0.22
Nodes (10): dependencies, next@16.4.2, @plant/contracts@workspace:*, exports, next, @plant/contracts, name, private (+2 more)

### Community 52 - "Cross Application Acceptance Tests"
Cohesion: 0.18
Nodes (4): actor, temporary, types, year

### Community 53 - "Next Application Build Configuration"
Cohesion: 0.27
Nodes (4): config, config, config, config

### Community 54 - "Auth TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 55 - "Bag TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 56 - "Consumables TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 57 - "Portal TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 58 - "Container Build Arguments"
Cohesion: 0.36
Nodes (10): APP, build, build, args, context, dockerfile, target, build (+2 more)

### Community 59 - "User Administration Services"
Cohesion: 0.22
Nodes (7): changePassword(), createUser(), mysqlCode(), passwordField(), stringField(), actor, materials

### Community 60 - "Product Operations Documentation"
Cohesion: 0.31
Nodes (9): BrandLogo artwork pipeline, Identitas TQ-CMMS, Application context sidebar navigation, Perbaikan sidebar dan dashboard Consumables, Proportional count chart and compact Portal, Separate transaction chart semantics, UI refresh v2 Plant Area System, Reversible overlays and momentum gestures (+1 more)

### Community 61 - "Bag Installation Storage"
Cohesion: 0.44
Nodes (8): `bag_audit`, bag_audit_equipment_time_idx, batch_equipment_time_idx, `coordinates`, `equipment`, installation_position_time_idx, `installations`, `replacement_batches`

### Community 62 - "Domain Contract Dependencies"
Cohesion: 0.25
Nodes (8): dependencies, zod@4.5.4, exports, zod, name, private, type, version

### Community 63 - "Gateway Recovery Verification"
Cohesion: 0.28
Nodes (7): actor, compose, docker(), inspect(), names, run, sentinels

### Community 64 - "Bag Operational Insights"
Cohesion: 0.54
Nodes (7): activity(), allowed(), dashboard(), iso(), scope(), ageBucket(), EquipmentCode

### Community 65 - "Development Smoke Verification"
Cohesion: 0.39
Nodes (6): docker(), exists(), parseEnv(), root, run, verifyIsolatedRuntime()

### Community 66 - "Consumables Workflow Acceptance Tests"
Cohesion: 0.29
Nodes (6): admin, materials, post(), roleUsers, save(), suffix

### Community 67 - "Authenticated Application Pages"
Cohesion: 0.38
Nodes (4): AuditList(), Event, Audit(), dynamic

### Community 68 - "Authenticated Application Pages"
Cohesion: 0.38
Nodes (5): dynamic, Page(), titles, PrintButton(), StockDocumentType

### Community 70 - "Database Test Infrastructure"
Cohesion: 0.33
Nodes (4): compose, docker(), persistedSql, run

### Community 71 - "Bag Bulk Selection Tests"
Cohesion: 0.43
Nodes (5): addFull(), area(), choose(), openBulk(), users

### Community 72 - "Bag Filter Container"
Cohesion: 0.40
Nodes (5): image, init, networks, restart, bag-filter

### Community 73 - "Consumables Application Container"
Cohesion: 0.40
Nodes (5): image, init, networks, restart, consumables

### Community 75 - "Brand Artwork Components"
Cohesion: 0.70
Nodes (3): brandRevision, compactArtwork, fullArtwork

### Community 76 - "Workspace Build Permissions"
Cohesion: 0.40
Nodes (4): allowBuilds, esbuild, sharp, packages

### Community 77 - "Source Formatting Configuration"
Cohesion: 0.40
Nodes (4): endOfLine, printWidth, singleQuote, trailingComma

### Community 82 - "Product Operations Documentation"
Cohesion: 0.50
Nodes (4): Portable schema and data fingerprint, CI verified full SHA release, R22 production backup rehearsal, Disposable MySQL and HTTPS QA

## Ambiguous Edges - Review These
- `compose()` → `project()`  [AMBIGUOUS]
  scripts/dev.ts · relation: indirect_call
- `setup()` → `project()`  [AMBIGUOUS]
  scripts/dev.ts · relation: indirect_call
- `verifyIsolatedRuntime()` → `project()`  [AMBIGUOUS]
  scripts/smoke-dev.ts · relation: indirect_call

## Knowledge Gaps
- **42 isolated node(s):** `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json`, `Lime Q accent` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 547 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Shared semantic theme tokens` connect `Product Operations Documentation` to `UI Design Token System`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `BagMonitor()` (e.g. with `dismiss()` and `keyboard()`) actually correct?**
  _`BagMonitor()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Errors and Stock Transactions` be split into smaller, more focused modules?**
  _Cohesion score 0.05108631826189078 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `Cross Application Acceptance Tests` to `Development Smoke Verification`, `Consumables Workflow Acceptance Tests`, `Development Tool Dependencies`, `Database Test Infrastructure`, `Brand Artwork Generation`, `Bag Bulk Selection Tests`, `Runtime Dependency Catalog`, `Cross Application Acceptance Tests`, `User Administration Services`, `Gateway Recovery Verification`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `compose()` and `project()`?**
  _Edge tagged AMBIGUOUS (relation: indirect_call) - confidence is low._
- **What is the exact relationship between `setup()` and `project()`?**
  _Edge tagged AMBIGUOUS (relation: indirect_call) - confidence is low._
## Extraction coverage and limitations

- The user excluded docs/testing/ from the main architecture graph. .graphifyignore preserves this scope for later scans.
- packages/ui/src/tokens.css is explicitly included after a filename-based sensitive-file false positive. packages/ui/src/styles.css anchors its real import chain from all four application layouts.
- CSS uses a file-scoped semantic extraction supplement because graphifyy 0.9.103 has no CSS AST extractor. .graphify_scope.json records the approved sources and fragment for future refreshes.
- AppError remains as a shared status/message/code contract spanning Auth, Bag Filter, Consumables, and server APIs. Its community membership follows its consumers.
- Measured token usage is unavailable from the host subagent tools. Zeros in cost.json are placeholders.
- Three same-name parser bindings to the UI project() function remain AMBIGUOUS with confidence 0.1. EXTRACTION_AUDIT.json records the source review.
- The graph preserves prior extracted relationships, including endpoint-pair collapse from the original undirected build. The original extraction diagnosed 176 collapsed pairs. Current diagnostics operate on the already assembled graph.
- graph.html loads vis-network from unpkg.com and needs network access for that library.
- .gitignore selects shared graphify-out/ artifacts for version control and keeps cache, machine-specific metadata, and temporary extraction files local.

### Graph integrity diagnostics

- dangling_endpoint_edges: 0
- missing_endpoint_edges: 0
- self_loop_edges: 5
- directed_same_endpoint_collapsed_edges: 0
- undirected_same_endpoint_collapsed_edges: 0

## Scope update verification

- Main graph contains 1,493 nodes, 3,907 edges, and 116 communities. All 529 testing-evidence nodes from the previous graph were removed.
- tokens.css contributes 17 nodes, with a styles.css entry point linked to all four application layouts and the active UI theme guide.
- AppError retains 91 relationships. Its declaration is packages/contracts/src/index.ts L210 and its shared API response handler is packages/server/src/index.ts L6.
- Headless Edge rendered the updated graph and successfully searched for and selected tokens.css, with zero page JavaScript errors.
