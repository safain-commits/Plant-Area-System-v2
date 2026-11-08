# Graph Report - plant-area-system-v2  (2026-11-08)

## Corpus Check
- 259 files · ~179,347 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1564 nodes · 3771 edges · 116 communities (75 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Shared Domain Contracts
- Product Operations Documentation
- Consumable Order Carts
- Shared Errors and Stock Transactions
- Cross Application Acceptance Tests
- Shared Errors and Stock Transactions
- Consumable Order Carts
- Consumable Order Carts
- Overlay Gesture Navigation
- Authentication Data Core
- Shared Errors and Stock Transactions
- Consumables Workspace Controls
- Repository Automation Scripts
- Dashboard Summary Components
- Auth Application Dependencies
- Bag Application Dependencies
- Consumables Application Dependencies
- Shared Errors and Stock Transactions
- Workspace Account Flows
- Portal Application Dependencies
- User Administration Services
- Database Migration Execution
- Authenticated Application Pages
- Bag Access Integration Tests
- Runtime Dependency Catalog
- Gateway Identity Verification
- Application Theme Layouts
- Consumables Inventory Schema
- User Administration Services
- UI Design Token System
- Compose Runtime Services
- Bag Operational Insights
- Administration Workspace Controls
- Database Migration Containers
- Consumables Core Dependencies
- Cross Application Acceptance Tests
- Authenticated Application Pages
- Continuous Integration Validation
- Auth Core Dependencies
- Shared TypeScript Configuration
- Container Build Arguments
- Compose Application Dependencies
- Development Tool Dependencies
- Bag Core Dependencies
- Shared UI Dependencies
- Next Application Build Configuration
- Nginx Service Routing
- Cross Application UI Design
- Database Snapshot Verification
- Local Development Setup
- Service Authentication Configuration
- MySQL Credential Configuration
- Authentication Storage Schema
- Container Health Checks
- Database Environment Configuration
- Database Migration Execution
- Server Package Dependencies
- Overlay Gesture Navigation
- Auth TypeScript Configuration
- Bag TypeScript Configuration
- Consumables TypeScript Configuration
- Portal TypeScript Configuration
- Authentication Data Core
- Bag Installation Storage
- Bag Access Integration Tests
- Domain Contract Dependencies
- Gateway Recovery Verification
- Gateway Identity Verification
- Brand Artwork Generation
- Development Smoke Verification
- Consumables Workflow Acceptance Tests
- Bag Access Integration Tests
- Database Test Infrastructure
- Database Test Infrastructure
- Compose Runtime Services
- Consumables Application Container
- Drizzle Migration Tooling
- Workspace Build Permissions
- Source Formatting Configuration
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
1. `AppError` - 92 edges
2. `BagMonitor()` - 49 edges
3. `Identity` - 40 edges
4. `Icon()` - 34 edges
5. `getAuthDb()` - 29 edges
6. `Overlay()` - 29 edges
7. `Button()` - 28 edges
8. `formatDate()` - 27 edges
9. `scripts` - 26 edges
10. `ConsumablesWorkspace()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `verifyIsolatedRuntime()` --indirect_call--> `project()`  [AMBIGUOUS]
  scripts/smoke-dev.ts → packages/ui/src/gesture.ts
- `GET()` --calls--> `getConsumablesDb()`  [EXTRACTED]
  apps/consumables/app/health/ready/route.ts → packages/consumables-core/src/database.ts
- `handler()` --calls--> `AppError`  [EXTRACTED]
  apps/portal/app/api/admin/[...path]/route.ts → packages/contracts/src/index.ts
- `fixture()` --calls--> `getConsumablesDb()`  [EXTRACTED]
  tests/integration/consumables-documents.test.ts → packages/consumables-core/src/database.ts
- `MaterialEditor()` --calls--> `allowsDecimals()`  [EXTRACTED]
  apps/consumables/app/workspace.tsx → packages/contracts/src/consumables.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cross-application UI modernization** — docs_design_ui_audit_portal_consumables_operational_hub, docs_design_ui_audit_portal_consumables_reversible_overlays, docs_design_ui_audit_portal_consumables_accessible_design_tokens, docs_design_ui_audit_portal_consumables_shell_skeleton, docs_design_ui_audit_portal_consumables_stock_query_feedback, docs_design_ui_audit_portal_consumables_reversible_cart [EXTRACTED 1.00]

## Communities (116 total, 41 thin omitted)

### Community 0 - "Shared Domain Contracts"
Cohesion: 0.05
Nodes (83): activeAgeSummary(), BatchCancellationDialog(), BatchRecord, CancellationNotice(), BulkSelection(), BulkSelectionForm(), Props, CoordinateHistory() (+75 more)

### Community 1 - "Product Operations Documentation"
Cohesion: 0.06
Nodes (62): BrandLogo artwork pipeline, Identitas TQ-CMMS, Kontrak API v2, Idempotent Bag Filter batches, R22 document API, Session identity and exact origin, Audit baseline Plant Area System, Legacy Vinext Cloudflare D1 export (+54 more)

### Community 2 - "Consumable Order Carts"
Cohesion: 0.07
Nodes (16): dynamic, Page(), titles, PrintButton(), MaterialSearch(), OrderCart(), Picklist(), stockApi() (+8 more)

### Community 3 - "Shared Errors and Stock Transactions"
Cohesion: 0.09
Nodes (31): Context, dynamic, GET(), json(), mutate(), PATCH, POST, DocumentConflict (+23 more)

### Community 4 - "Cross Application Acceptance Tests"
Cohesion: 0.09
Nodes (16): closeAuthDb(), authSchema, closeBagDb(), bagSchema, Identity, extra, addFull(), area() (+8 more)

### Community 5 - "Shared Errors and Stock Transactions"
Cohesion: 0.09
Nodes (27): dynamic, GET(), cache, closeConsumablesDb(), create(), getConsumablesDb(), importCatalog(), parseCatalog() (+19 more)

### Community 6 - "Consumable Order Carts"
Cohesion: 0.13
Nodes (22): AddToOrder(), QuantityDialog(), localDecimal(), MaterialSearchResult, Confirmation, ConfirmationOptions, ConfirmFunction, LogoutButton() (+14 more)

### Community 7 - "Consumable Order Carts"
Cohesion: 0.14
Nodes (26): createDocument(), parseNamingCsv(), amount, canConsume(), canonicalDocumentPayload(), ConsumablesGrant, ConsumablesRole, consumablesRoles (+18 more)

### Community 8 - "Overlay Gesture Navigation"
Cohesion: 0.16
Nodes (20): ConfirmationProvider(), DateTimeField(), highlight(), Select(), TimeColumn(), Icon(), IconName, paths (+12 more)

### Community 9 - "Authentication Data Core"
Cohesion: 0.15
Nodes (20): dynamic, POST(), dynamic, GET(), buildAuth(), getAuth(), publicOrigin(), cache (+12 more)

### Community 10 - "Shared Errors and Stock Transactions"
Cohesion: 0.15
Nodes (24): replay(), date, dateConditions(), docCols, documentDetail(), header, hec, hecSuggestions() (+16 more)

### Community 11 - "Consumables Workspace Controls"
Cohesion: 0.19
Nodes (23): AliasInput(), AuditItem, ConsumablesWorkspace(), openMaterial(), Enrollment(), get(), InventoryEditor(), labels (+15 more)

### Community 12 - "Repository Automation Scripts"
Cohesion: 0.08
Nodes (26): scripts, bootstrap, brand:generate, build, check:export, consumables:import, consumables:import-naming, consumables:preflight (+18 more)

### Community 13 - "Dashboard Summary Components"
Cohesion: 0.11
Nodes (17): countScale(), AnimatedNumber(), Dashboard(), n(), ChartQuarter, ChartSeries, number(), QuarterlyChart() (+9 more)

### Community 14 - "Auth Application Dependencies"
Cohesion: 0.10
Nodes (24): dependencies, next@16.4.2, @plant/auth-core@workspace:*, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1 (+16 more)

### Community 15 - "Bag Application Dependencies"
Cohesion: 0.10
Nodes (24): dependencies, next@16.4.2, @plant/bag-core@workspace:*, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1 (+16 more)

### Community 16 - "Consumables Application Dependencies"
Cohesion: 0.10
Nodes (24): dependencies, next@16.4.2, @plant/consumables-core@workspace:*, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1 (+16 more)

### Community 17 - "Shared Errors and Stock Transactions"
Cohesion: 0.13
Nodes (18): common, inventoryInput, materialInput, MoveKind, schemas, code(), entry(), Executor (+10 more)

### Community 18 - "Workspace Account Flows"
Cohesion: 0.15
Nodes (15): ChangePassword(), dynamic, LoginForm(), PasswordForm(), dynamic, Login(), Loading(), Loading() (+7 more)

### Community 19 - "Portal Application Dependencies"
Cohesion: 0.11
Nodes (22): dependencies, next@16.4.2, @plant/contracts@workspace:*, @plant/server@workspace:*, @plant/ui@workspace:*, react@19.3.1, react-dom@19.3.1, next (+14 more)

### Community 20 - "User Administration Services"
Cohesion: 0.12
Nodes (10): changePassword(), createUser(), mysqlCode(), passwordField(), stringField(), @playwright/test, actor, actor (+2 more)

### Community 21 - "Database Migration Execution"
Cohesion: 0.17
Nodes (12): canonicalReplacement(), seedEquipment(), equipmentPositions(), migrateConsumablesCatalog(), provision(), provisionConsumables(), preflightSingleRoom(), equipmentMigrationId (+4 more)

### Community 22 - "Authenticated Application Pages"
Cohesion: 0.16
Nodes (15): AuditList(), Event, Audit(), dynamic, BagFilter(), dynamic, dynamic, Page() (+7 more)

### Community 23 - "Bag Access Integration Tests"
Cohesion: 0.17
Nodes (17): dynamic, GET(), CancellationColumns, cancellationMetadata(), cache, createDatabase(), getBagDb(), Cursor (+9 more)

### Community 24 - "Runtime Dependency Catalog"
Cohesion: 0.13
Nodes (21): dependencies, better-auth@1.7.12, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/auth-core@workspace:*, @plant/bag-core@workspace:*, @plant/consumables-core@workspace:*, @plant/contracts@workspace:* (+13 more)

### Community 25 - "Gateway Identity Verification"
Cohesion: 0.19
Nodes (16): dynamic, GET(), dynamic, GET(), dynamic, GET, handler(), POST (+8 more)

### Community 26 - "Application Theme Layouts"
Cohesion: 0.16
Nodes (14): inter, Layout(), metadata, inter, Layout(), metadata, inter, Layout() (+6 more)

### Community 27 - "Consumables Inventory Schema"
Cohesion: 0.18
Nodes (19): `catalog_imports`, `consumables_audit`, consumables_audit_time_idx, `inventory`, inventory_location_idx, `locations`, material_category_idx, `materials` (+11 more)

### Community 28 - "User Administration Services"
Cohesion: 0.30
Nodes (18): Context, dynamic, GET(), POST(), getAuthDb(), auditEntry(), authAudit(), decodeGrant() (+10 more)

### Community 29 - "UI Design Token System"
Cohesion: 0.20
Nodes (18): SIL Open Font License 1.1, Inter v4.1 Self-Hosted Font Asset, Bag age color scale, Brand color aliases, Design system cascade layers, Chart hatch patterns, Theme aware chart series, Component radius tokens (+10 more)

### Community 30 - "Compose Runtime Services"
Cohesion: 0.11
Nodes (17): command, image, networks, profiles, name, networks, gateway, private (+9 more)

### Community 31 - "Bag Operational Insights"
Cohesion: 0.25
Nodes (14): Context, dynamic, GET(), json(), POST(), activity(), ageTones, allowed() (+6 more)

### Community 32 - "Administration Workspace Controls"
Cohesion: 0.23
Nodes (13): Application, Applications(), Admin(), dynamic, AdminWorkspace(), act(), ConsumablesAccess(), ManagedUser (+5 more)

### Community 33 - "Database Migration Containers"
Cohesion: 0.12
Nodes (17): depends_on, entrypoint, environment, image, networks, restart, volumes, mysql (+9 more)

### Community 34 - "Consumables Core Dependencies"
Cohesion: 0.15
Nodes (16): dependencies, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/contracts@workspace:*, zod@4.5.4, exports, ./import, ./schema (+8 more)

### Community 35 - "Cross Application Acceptance Tests"
Cohesion: 0.12
Nodes (8): StockDashboard, equipmentCodes, paths, actor, temporary, theme(), types, year

### Community 36 - "Authenticated Application Pages"
Cohesion: 0.15
Nodes (14): dynamic, Portal(), wibDateFormatter, AppId, PortalSummary, PortalTone, ageKeys, AppSummaryState (+6 more)

### Community 37 - "Continuous Integration Validation"
Cohesion: 0.12
Nodes (15): jobs, validate, name, on, permissions, contents, if, name (+7 more)

### Community 38 - "Auth Core Dependencies"
Cohesion: 0.16
Nodes (15): dependencies, better-auth@1.7.12, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/contracts@workspace:*, exports, ./schema, better-auth (+7 more)

### Community 39 - "Shared TypeScript Configuration"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, esModuleInterop, jsx, lib, module, moduleResolution, noEmit (+7 more)

### Community 40 - "Container Build Arguments"
Cohesion: 0.20
Nodes (15): APP, build, build, image, init, networks, restart, args (+7 more)

### Community 41 - "Compose Application Dependencies"
Cohesion: 0.15
Nodes (14): condition, depends_on, depends_on, depends_on, depends_on, auth, migrate, condition (+6 more)

### Community 42 - "Development Tool Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @playwright/test@1.64.1, prettier@3.9.10, tsx@4.23.15, @types/node@22.19.19, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3 (+6 more)

### Community 43 - "Bag Core Dependencies"
Cohesion: 0.18
Nodes (13): dependencies, drizzle-orm@0.45.4, mysql2@3.24.6, @plant/contracts@workspace:*, exports, ./schema, drizzle-orm, mysql2 (+5 more)

### Community 44 - "Shared UI Dependencies"
Cohesion: 0.18
Nodes (13): dependencies, @plant/contracts@workspace:*, react@19.3.1, react-dom@19.3.1, exports, ./styles.css, @plant/contracts, react (+5 more)

### Community 45 - "Next Application Build Configuration"
Cohesion: 0.23
Nodes (4): config, config, config, config

### Community 46 - "Nginx Service Routing"
Cohesion: 0.15
Nodes (13): condition, condition, bag-filter, consumables, portal, depends_on, image, networks (+5 more)

### Community 47 - "Cross Application UI Design"
Cohesion: 0.18
Nodes (11): Accessible design tokens, Portal and Consumables UI audit, Momentum-aware drawer gestures, Portal operational hub, Reversible cart feedback, ShellSkeleton navigation fallback, Bag age map and selection, UI Refresh Brief v2 (+3 more)

### Community 48 - "Database Snapshot Verification"
Cohesion: 0.21
Nodes (11): args, capture(), compare(), databases, ephemeral, identifier(), migrationsHash(), walk() (+3 more)

### Community 49 - "Local Development Setup"
Cohesion: 0.31
Nodes (12): apps, compose(), cores, docker(), execute(), exists(), localEngine(), profile() (+4 more)

### Community 50 - "Service Authentication Configuration"
Cohesion: 0.36
Nodes (12): environment, environment, environment, AUTH_INTERNAL_URL, AUTH_SECRET, NGINX_ENVSUBST_FILTER, NODE_ENV, PUBLIC_ORIGIN (+4 more)

### Community 51 - "MySQL Credential Configuration"
Cohesion: 0.17
Nodes (12): AUTH_DB_PASSWORD, BAG_DB_PASSWORD, CONSUMABLES_DB_PASSWORD, MYSQL_ROOT_HOST, MYSQL_ROOT_PASSWORD, command, environment, image (+4 more)

### Community 52 - "Authentication Storage Schema"
Cohesion: 0.27
Nodes (11): account_user_idx, `accounts`, `app_grants`, `applications`, `auth_audit`, auth_audit_time_idx, `login_attempts`, session_user_idx (+3 more)

### Community 53 - "Container Health Checks"
Cohesion: 0.55
Nodes (11): healthcheck, healthcheck, healthcheck, interval, retries, start_period, test, timeout (+3 more)

### Community 54 - "Database Environment Configuration"
Cohesion: 0.27
Nodes (11): environment, AUTH_DATABASE_URL, AUTH_MIGRATION_DATABASE_URL, BAG_DATABASE_URL, BAG_MIGRATION_DATABASE_URL, BOOTSTRAP_EMAIL, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD (+3 more)

### Community 56 - "Server Package Dependencies"
Cohesion: 0.22
Nodes (10): dependencies, next@16.4.2, @plant/contracts@workspace:*, exports, next, @plant/contracts, name, private (+2 more)

### Community 57 - "Overlay Gesture Navigation"
Cohesion: 0.42
Nodes (7): project(), record(), rubberband(), Sample, shouldDismiss(), spring(), velocity()

### Community 58 - "Auth TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 59 - "Bag TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 60 - "Consumables TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 61 - "Portal TypeScript Configuration"
Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, incremental, jsx, plugins, exclude, extends, include (+1 more)

### Community 63 - "Bag Installation Storage"
Cohesion: 0.44
Nodes (8): `bag_audit`, bag_audit_equipment_time_idx, batch_equipment_time_idx, `coordinates`, `equipment`, installation_position_time_idx, `installations`, `replacement_batches`

### Community 64 - "Bag Access Integration Tests"
Cohesion: 0.28
Nodes (7): codeOf(), createReplacement(), actor, body(), create(), other, p

### Community 65 - "Domain Contract Dependencies"
Cohesion: 0.25
Nodes (8): dependencies, zod@4.5.4, exports, zod, name, private, type, version

### Community 66 - "Gateway Recovery Verification"
Cohesion: 0.28
Nodes (7): actor, compose, docker(), inspect(), names, run, sentinels

### Community 67 - "Gateway Identity Verification"
Cohesion: 0.43
Nodes (7): dynamic, EquipmentPage(), cancelReplacement(), errorCode(), snapshot(), getEquipment(), hasPermission()

### Community 68 - "Brand Artwork Generation"
Cohesion: 0.25
Nodes (5): [full, compact], outputs, revision, root, sources

### Community 69 - "Development Smoke Verification"
Cohesion: 0.39
Nodes (6): docker(), exists(), parseEnv(), root, run, verifyIsolatedRuntime()

### Community 70 - "Consumables Workflow Acceptance Tests"
Cohesion: 0.29
Nodes (6): admin, materials, post(), roleUsers, save(), suffix

### Community 71 - "Bag Access Integration Tests"
Cohesion: 0.48
Nodes (7): auditHistory(), batchHistory(), cursor(), dateString(), encodeCursor(), likeText(), positionHistory()

### Community 73 - "Database Test Infrastructure"
Cohesion: 0.33
Nodes (4): compose, docker(), persistedSql, run

### Community 74 - "Compose Runtime Services"
Cohesion: 0.40
Nodes (5): image, init, networks, restart, auth

### Community 75 - "Consumables Application Container"
Cohesion: 0.40
Nodes (5): image, init, networks, restart, consumables

### Community 77 - "Workspace Build Permissions"
Cohesion: 0.40
Nodes (4): allowBuilds, esbuild, sharp, packages

### Community 78 - "Source Formatting Configuration"
Cohesion: 0.40
Nodes (4): endOfLine, printWidth, singleQuote, trailingComma

## Ambiguous Edges - Review These
- `verifyIsolatedRuntime()` → `project()`  [AMBIGUOUS]
  scripts/smoke-dev.ts · relation: indirect_call

## Knowledge Gaps
- **42 isolated node(s):** `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json`, `Lime Q accent` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 583 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@playwright/test` connect `User Administration Services` to `Gateway Recovery Verification`, `Cross Application Acceptance Tests`, `Cross Application Acceptance Tests`, `Development Smoke Verification`, `Consumables Workflow Acceptance Tests`, `Database Test Infrastructure`, `Development Tool Dependencies`, `Runtime Dependency Catalog`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `BagMonitor()` (e.g. with `dismiss()` and `keyboard()`) actually correct?**
  _`BagMonitor()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Domain Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.05274725274725275 - nodes in this community are weakly interconnected._
- **Why does `Shared semantic theme tokens` connect `Product Operations Documentation` to `UI Design Token System`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `Product Operations Documentation` be split into smaller, more focused modules?**
  _Cohesion score 0.06187202538339503 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `verifyIsolatedRuntime()` and `project()`?**
  _Edge tagged AMBIGUOUS (relation: indirect_call) - confidence is low._