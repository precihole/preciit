# PreciIT

IT Service & Asset Management for Precihole

## Overview

This app provides an **IT Asset Lifecycle Management** workflow to track and manage IT assets from procurement through retirement.

It supports:

- Centralized asset tracking
- Complete asset history
- Employee allocation management
- Branch/location transfer tracking
- Repair and maintenance records
- Controlled decommission process
- Better inventory visibility
- Audit and compliance support

## Supported Lifecycle

### Asset Lifecycle Flow (readable)

```text
DRAFT
  ↓
IN STOCK
  ↓
SOFTWARE CONFIGURED
  ↓
AVAILABLE
  ├─▶ TRANSFER
  │      ↓
  │  TRANSFER RETURN
  │      ↓
  │     AVAILABLE
  │
  └─▶ ALLOCATED
         ↓
     DEALLOCATED
         ├─▶ AVAILABLE
         ├─▶ REPAIR
         └─▶ DECOMMISSION (END)

REPAIR
  ↓
AVAILABLE
```


### Lifecycle Status Explanation

| Status | Description |
|---|---|
| Draft | Initial asset creation with hardware and purchase details |
| In Stock | Asset physically received and stored in inventory |
| Software Configured | OS, licenses, antivirus, and company software configured |
| Available | Asset ready for allocation or branch transfer |
| Transfer | Asset moving to another branch/location |
| Transfer Return | Destination branch confirms asset received |
| Allocated | Asset assigned to employee |
| Deallocated | Asset returned by employee |
| Repair | Asset under maintenance or repair |
| Decommission | End of Life (EOL), permanently retired |

### Status Transition Rules

| Current Status | Allowed Next Status |
|---|---|
| Draft | In Stock |
| In Stock | Software Configured |
| Software Configured | Available |
| Available | Allocated / Transfer |
| Transfer | Transfer Return |
| Transfer Return | Available |
| Allocated | Deallocated |
| Deallocated | Available / Repair / Decommission |
| Repair | Available |
| Decommission | Final State |

### Business Rules

- Only **Available** assets can be **Allocated**.
- Only **Available** assets can be **Transferred**.
- **Transfer** cannot be used to allocate assets (asset stays non-allocatable during transfer).
- **Transfer Return** is confirmed by the destination branch.
- After **Transfer Return**, the asset becomes **Available** again.
- **Allocated** assets cannot be transferred directly.
- An asset must be **Deallocated** before it can be transferred or repaired.
- **Repair** assets cannot be allocated during repair.
- After **Repair** completion, the asset becomes **Available** again.
- **Decommission** is final: no further actions allowed.

### Example Asset Journey

1. Asset Created → **Draft**
2. Asset Received → **In Stock**
3. Software Installed → **Software Configured**
4. Ready for Use → **Available**
5. Transferred to Another Branch → **Transfer**
6. Destination Branch Received Asset → **Transfer Return**
7. Asset Ready Again → **Available**
8. Assigned to Employee → **Allocated**
9. Employee Returned Device → **Deallocated**
10. Asset Sent for Repair → **Repair**
11. Repair Completed → **Available**
12. Reassigned to Employee → **Allocated**
13. Asset End of Life → **Decommission**

### Status Flow (high level)

```text
                         ┌─────────────────┐
                         │      DRAFT      │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │    IN STOCK     │
                         └────────┬────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ SOFTWARE CONFIGURED     │
                    └────────┬────────────────┘
                             │
                             ▼
                    ┌─────────────────────────┐
                    │       AVAILABLE         │
                    └───────┬─────────┬──────┘
                            │         │
              Allocate      │         │ Transfer
                            │         │
                            ▼         ▼
                  ┌─────────────┐   ┌────────────────┐
                  │  ALLOCATED  │   │    TRANSFER    │
                  └──────┬──────┘   └────────┬───────┘
                         │                   │
                         │                   ▼
                         │          ┌─────────────────┐
                         │          │ TRANSFER RETURN │
                         │          └────────┬────────┘
                         │                   │
                         ▼                   ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │  DEALLOCATED    │──►│    AVAILABLE    │
                 └──────┬────┬─────┘   └─────────────────┘
                        │    │
                        │    │
                        │    ▼
                        │ ┌─────────────────┐
                        │ │  DECOMMISSION   │
                        │ └────────┬────────┘
                        │          │
                        │          ▼
                        │        [END]
                        │
                        ▼
                ┌─────────────────┐
                │     REPAIR      │
                └────────┬────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  AVAILABLE   │
                  └──────────────┘
```

**Decommission** is the final state (**END**).



### Asset Lifecycle Stages (rules)

| Stage | Purpose | Allowed Actions |
|---|---|---|
| **Draft** | Initial asset record is created. Hardware, purchase, vendor, serial, invoice, warranty are added. | **Create only.** No allocation/transfer. |
| **In Stock** | Asset is physically received and stored in inventory. | **Verify & tag.** No allocation/transfer. |
| **Software Configured** | OS, security, company software, licenses, VPN/domain/MDM setup completed. | **Configuration only.** No allocation yet. |
| **Available** | Final testing/quality verification done; asset is ready for business use. | **Allocate and/or Transfer.** |
| **Transfer** | Asset is moving between branches/locations. | Transfer tracking/approval. **No allocation.** |
| **Transfer Return** | Destination branch confirms receipt and inventory verification. | Completes transfer; asset returns to **Available**. |
| **Allocated** | Asset is assigned to an employee/department. | Allocation tracking only. **No direct transfer.** |
| **Deallocated** | Asset returned by employee; data cleanup & condition verification done. | Can be moved to **Available**, **Repair**, or **Decommission**. |
| **Repair** | Hardware/software troubleshooting and maintenance in progress. | **Maintenance only.** No allocation/transfer. |
| **Decommission** | Final retirement: scrap/recycling/disposal/sell-off; no further lifecycle actions. | Terminal state (**END**). |

## Asset Journey
```
1. Asset Created
   → Draft

2. Asset Received
   → In Stock

3. Software Installed
   → Software Configured

4. Ready for Usage
   → Available

5. Assigned to Employee
   → Allocated

6. Employee Returned Device
   → Deallocated

7. Sent for Repair
   → Repair

8. Repair Completed
   → Available

9. Transferred to Another Branch
   → Transfer

10. Destination Branch Received Asset
   → Transfer Return

11. Asset Ready Again
   → Available

12. Reassigned to Employee
   → Allocated

13. Asset Retired
   → Decommission

```

## Install


You can install this app using the **bench** CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app preciit
```

## Development

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/preciit
pre-commit install
```

### Tooling

Pre-commit is configured to use the following tools for checking and formatting:

- ruff
- eslint
- prettier
- pyupgrade

## CI

This app can use GitHub Actions for CI. The following workflows are configured:

- **CI**: Installs this app and runs unit tests on every push to `develop`.
- **Linters**: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and `pip-audit` on every pull request.

## License

MIT. See [license.txt](license.txt).

