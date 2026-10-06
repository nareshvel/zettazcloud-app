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
| [Final architecture blueprint](./PRINT_MODULE_FINAL_BLUEPRINT.md) | Final independent Zettaz Cloud Print Module architecture, job contract, templates, custom designer, devices, routing, and future app readiness |
| [Print architecture audit](./print-architecture-audit.md) | Current-state code audit, research findings, risks, and target architecture |
| [Implementation plan and task schedule](./print-implementation-plan.md) | Sequenced plan of action, milestones, dependencies, acceptance criteria, and rollout strategy |
| [Receipt printing implementation](./receipt-printing-implementation.md) | Existing receipt implementation specification and historical context |
| [Receipt printing tasks](./receipt-printing-tasks.md) | Existing receipt-specific task list; superseded by the broader implementation plan |
| [Printer user manual](./printer-user-manual.md) | Hardware reference manual for the 80-series receipt printer |
| [Phase 1: store-level print routes](./PHASE_1_STORE_LEVEL_ROUTES.md) | Handoff for the code-complete but not fully field-proven store-level `print_document_settings` checkout path |
| [Printer Settings UX and logic redesign](./PRINTER_SETTINGS_UX_AND_LOGIC_REDESIGN_PLAN.md) | Approved alignment decisions, runtime fixes, target UI, phased tasks, validation contract, tests, and field-proving criteria |
| [Print Agent audit and operations](./PRINT_AGENT_AUDIT_AND_OPERATIONS.md) | Architecture, Windows/macOS installation, installer packaging, direct-vs-agent guidance, simulator QA, cleanup proposal, and release checklist |
| [Print delivery and Agent completion plan](./PRINT_DELIVERY_AND_AGENT_COMPLETION_PLAN.md) | Canonical payload strategy, Electron-vs-Go decision, complete network ESC/POS scope, return modernization, shared Agent v2 contract, security, and certification schedule |
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
