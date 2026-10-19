---
name: Single public account model
description: Product decision for public account types and internal staff capabilities.
---

Every public account registers and signs in as one `User` account. A user can browse, save, inquire, and list properties from that account; listing access should not require a Seller account type. Administrative, agent, and developer capabilities remain separate internal permissions.

**Why:** The product owner chose a single public account type while explicitly preserving internal access needed for moderation and operations.

**How to apply:** Do not expose Buyer/Seller choices in public signup. Never trust a submitted account type to grant staff permissions; preserve existing staff access through server-checked capabilities.
