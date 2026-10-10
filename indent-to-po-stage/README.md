# Store Procurement Workflow: Create Indent to PO History

This directory contains copies of all working components, pages, services, store/context, types, hooks, and utilities covering the entire workflow from **Create Indent** through **PO History**.

---

## 1. Workflow Pipeline Overview

| Step | Stage Name | Page / View File | Service File | Database Tables Involved |
|:---|:---|:---|:---|:---|
| 1 | **Create Indent** | `pages_and_views/CreateIndent.tsx` | `services/indentService.ts` | `indent` |
| 2 | **Department Indent Approval** | `pages_and_views/ApproveIndent.tsx` | `services/indentService.ts` | `indent` |
| 3 | **Vendor Rate Update** | `pages_and_views/VendorUpdate.tsx` | `services/vendorUpdateService.ts` | `indent`, `master_vendors` |
| 4 | **Technical Approval** | `pages_and_views/TechnicalApproval.tsx` | `services/technicalApprovalService.ts` | `indent` |
| 5 | **Management Rate Approval** | `pages_and_views/RateApproval.tsx` | `services/rateApprovalService.ts` | `indent` |
| 6 | **Pending PO to be Created** | `pages_and_views/PendingPo.tsx` | `services/indentService.ts`, `services/poService.ts` | `indent` |
| 6b | **Pending Indents (Auxiliary)** | `pages_and_views/PendingIndents.tsx` | `services/indentService.ts` | `indent` |
| 7 | **Create PO** | `pages_and_views/CreatePO.tsx` | `services/poService.ts` | `po_master`, `indent` |
| 8 | **PO History** | `pages_and_views/Order.tsx` | `services/poService.ts` | `po_master`, `indent`, `store_in` |
| 8b | **PO Master (Overview)** | `pages_and_views/POMaster.tsx` | `services/poService.ts` | `po_master`, `indent` |
| Aux | **Enquiry / Quotation** | `pages_and_views/Quotation.tsx` | `services/quotationService.ts` | `quotations` |
| Aux | **Vendor Bidding** | `pages_and_views/VendorBidding.tsx` | `services/quotationService.ts` | `quotations`, `vendors` |

---

## 2. Directory Structure

```text
indent-to-po-stage/
├── pages_and_views/
│   ├── CreateIndent.tsx            # Stage 1: Indent creation form & active indent listing
│   ├── ApproveIndent.tsx           # Stage 2: HOD/Dept approval of indents
│   ├── VendorUpdate.tsx            # Stage 3: 3-Vendor quote gathering & comparison
│   ├── TechnicalApproval.tsx       # Stage 4: Department technical evaluation (T1/T2/T3)
│   ├── RateApproval.tsx            # Stage 5: Management final vendor/rate selection
│   ├── PendingPo.tsx               # Stage 6: Dashboard of approved indents awaiting PO
│   ├── PendingIndents.tsx          # Stage 6b: PO to make/not status tracking
│   ├── CreatePO.tsx                # Stage 7: PO generator & PDF creation
│   ├── Order.tsx                   # Stage 8: PO History dashboard
│   ├── POMaster.tsx                # PO Master overview & preview
│   ├── Quotation.tsx               # RFQ / Quotation generator
│   └── VendorBidding.tsx           # External vendor bidding portal
│
├── components/
│   └── element/
│       ├── IndentPdf.tsx           # PDF generator for Indent documents
│       ├── POPdf.tsx               # PDF generator for Purchase Orders
│       ├── QuotationPdf.tsx        # PDF generator for Vendor Quotations
│       ├── AttachmentUploadField.tsx # Multi-file upload component
│       ├── StageDeleteDialog.tsx   # Rollback / delete confirmation modal
│       ├── DataTable.tsx           # Standard TanStack table with search & pagination
│       ├── Heading.tsx             # Standard section header with action buttons
│       ├── FilterToolbar.tsx       # Filter controls for tabular views
│       ├── PermissionGuard.tsx     # RBAC access guard
│       ├── ViewOnlyGuard.tsx       # View-only restriction guard
│       └── MediaPreviewDialog.tsx  # Document/image viewer modal
│
├── services/
│   ├── indentService.ts            # CRUD & stage resets for Indents
│   ├── poService.ts                # CRUD & stage resets for Purchase Orders
│   ├── vendorUpdateService.ts      # Multi-vendor pricing submission
│   ├── technicalApprovalService.ts # Technical ranking (T1/T2/T3) submission
│   ├── rateApprovalService.ts      # Management rate approval submission
│   ├── quotationService.ts         # Vendor quotation APIs
│   └── masterService.ts            # Master data (vendors, items, units)
│
├── store_and_context/
│   ├── SheetsContext.tsx           # Primary Store & procurement state manager
│   ├── ProjectContext.tsx          # Project/firm selection context
│   ├── AuthContext.tsx             # User authentication context
│   ├── hook.ts                     # Redux/store dispatch & selector hooks
│   └── slice/
│       ├── permissionsSlice.ts     # User permission state
│       └── userAccountData.ts      # User profile state
│
├── hooks/
│   ├── useAttachmentUpload.ts      # Hook for uploading indent/PO attachments
│   └── useFileUpload.ts            # Presigned URL and upload hook
│
├── types/
│   ├── indentForm.ts               # Indent form schemas & types
│   ├── sheets.ts                   # Store sheets & permission type interfaces
│   ├── types.ts                    # Core procurement record types
│   ├── routes.ts                   # Route definition interfaces
│   ├── permissions.ts              # System permission structures
│   └── index.ts                    # Root export of common types
│
├── lib_and_utils/
│   ├── poPdfUtils.ts               # PO PDF generation, preview & formatting helpers
│   ├── inventoryUtils.ts           # Real inventory calculations
│   ├── apiClient.ts                # Supabase / REST client singleton
│   ├── firmAccess.ts               # Multi-tenant firm access filtering
│   ├── roleAccess.ts               # Role-based stage deletion permissions
│   ├── fetchers.ts                 # File upload & data fetching utilities
│   └── utils.ts                    # Common formatting (dates, currency, cn)
│
└── docs/
    └── Workflow.md                 # Detailed procurement workflow specification
```
