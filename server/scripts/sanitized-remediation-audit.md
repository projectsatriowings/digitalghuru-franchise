# SANITIZED DATABASE REMEDIATION AUDIT LOG

**Timestamp:** 2026-11-14T09:00:39Z  
**Scope:** Remediation of 16 conflicting institute records for functional unique email index.  
**PII Protection:** All personal identifiers, phone numbers, individual user accounts, and street addresses sanitized.

---

### Remediation Action Summary

| Record Code | Institute Category | Pre-Remediation Status | Post-Remediation Status | Linked Entities Count |
| :--- | :--- | :--- | :--- | :--- |
| `DG-ANN-8108` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-2173` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-3395` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-0104` | Standalone Historical Test Seed | Email populated | `NULL` | 1 Student, 1 Batch, 1 Payment |
| `DG-ANN-6197` | Standalone Historical Test Seed | Email populated | `NULL` | 1 Student, 1 Batch, 1 Payment |
| `DG-ANN-8844` | Standalone Historical Test Seed | Email populated | `NULL` | 1 Student, 1 Batch, 1 Payment |
| `DG-ANN-9934` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-2473` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-8660` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-3621` | Standalone Historical Test Seed | Email populated | `NULL` | 1 Student, 1 Batch, 1 Payment |
| `DG-ANN-9447` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-6344` | Standalone Historical Test Seed | Email populated | `NULL` | 0 Students, 0 Batches, 0 Payments |
| `DG-ANN-2175` | Standalone Historical Test Seed | Email populated | `NULL` | 1 Student, 1 Batch, 1 Payment |
| `DG-ANN-5438` | Franchise Center DG-FR-1016 | Canonical Email Active | Retained Canonical | 1 Staff, 3 Batches, 6 Enrollments |
| `INS-A3DFD6` | Standalone Campus | Admin Match Email Active | Retained | 1 Academic Admin Account |
| `INS-88C176` | Standalone Campus | Duplicate Email Active | Replaced with Admin Email | 1 Academic Admin Account |

---

### Verification
- **Functional Index:** `Institute_email_normalized_unique_idx` active.
- **Active Duplicates:** 0 across all institutes.

