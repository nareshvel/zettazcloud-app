# Print Module Documentation

This directory is the source of truth for Zettaz Cloud printing architecture, printer configuration, templates, integrations, compliance-oriented documents, testing, and implementation planning.

## Scope

The Print Module covers:

- POS thermal receipts and cash-drawer workflows
- A4/Letter invoices and professional documents
- Jewelry invoices, certificates, warranties, repair documents, and vouchers
- Product, inventory, jewelry, shelf, and barcode tags
- Zebra ZPL and TSC/Godex TSPL label printing
- Browser, local-agent, network, and cloud-connected printing
- Printer profiles, print stations, routing rules, templates, and print jobs
- Duty-free and tax-free document customization
- Print security, reliability, observability, and support procedures

## Documents

| Document | Purpose |
|---|---|
| [Print flow and configuration](./PRINT_FLOW_AND_CONFIGURATION.md) | **Start here.** Runtime-truth reference: document types, delivery modes, when the Print Agent is needed, label printing, fallbacks, and a decision guide |
| [Cloud-mediated printing design](./CLOUD_MEDIATED_PRINTING_DESIGN.md) | Tier 1 proposal — enroll workstation once, cloud job queue, per-agent printer mappings; pairing becomes the fallback path |
| [Network ESC/POS troubleshooting](./NETWORK_ESCPOS_TROUBLESHOOTING.md) | Debugging checklist for the raster-based `direct` delivery mode |
| [Phase 1: store-level print routes](./PHASE_1_STORE_LEVEL_ROUTES.md) | Handoff for the code-complete but not fully field-proven store-level `print_document_settings` checkout path |
| [Printer Settings UX and logic redesign](./PRINTER_SETTINGS_UX_AND_LOGIC_REDESIGN_PLAN.md) | Approved alignment decisions, runtime fixes, target UI, phased tasks, validation contract, tests, and field-proving criteria |
| [Print Agent audit and operations](./PRINT_AGENT_AUDIT_AND_OPERATIONS.md) | Architecture, Windows/macOS installation, installer packaging, direct-vs-agent guidance, simulator QA, cleanup proposal, and release checklist |
| [Print delivery and Agent completion plan](./PRINT_DELIVERY_AND_AGENT_COMPLETION_PLAN.md) | Canonical payload strategy, Electron-vs-Go decision, complete network ESC/POS scope, return modernization, shared Agent v2 contract, security, and certification schedule |
| [Print job service phase 2](./PRINT_JOB_SERVICE_PHASE2.md) | Durable print-job orchestration work |
| [Security hardening phase 1](./SECURITY_HARDENING_PHASE1.md) | Print-path security fixes |
| [Phase 3: templates and duty-free](./PHASE3_TEMPLATES_DUTY_FREE.md) | Template/duty-free phase notes |
| [Template inventory and maintenance](./TEMPLATE_INVENTORY_AND_MAINTENANCE.md) | Industry template inventory, conditional duty-free/tax-refund documents, return gap, and safe update/provisioning workflow |

## Status

The architecture blueprint and substantial print-module implementation now exist: structured Print Templates, renderers, store-level document settings, printer/device and print-job services, adapters, fixtures, and related UI. These parts are not equally field-proven. Iteration 17.3 fixed explicit template selection, Auto Print behavior, atomic settings save, media modeling, route tests, and the Printer Settings information architecture. Automated verification is complete; use the redesign plan's Phase G checklist for field QA. Durable print-job orchestration and station-level routing remain separate from this Printer Settings redesign unless an explicit integration milestone is approved.

## Review checklist

Before implementation begins, review and approve:

- [ ] Independent Zettaz Cloud Print Module boundary
- [ ] Future app name and client strategy: **Zettaz Cloud**
- [ ] Printer and station data model
- [ ] Document-type taxonomy
- [ ] Canonical document payload contract
- [ ] Template strategy: structured blocks, layout editor, label designer, advanced source mode
- [ ] Local Agent API and security model
- [ ] Mobile-client readiness without committing to native implementation yet
- [ ] Cloud printer strategy, if required
- [ ] Duty-free jurisdictions and legal requirements
- [ ] Migration and backward-compatibility strategy
- [ ] Printer certification matrix
- [ ] Print-job retention and audit policy
- [ ] Rollout and rollback plan
