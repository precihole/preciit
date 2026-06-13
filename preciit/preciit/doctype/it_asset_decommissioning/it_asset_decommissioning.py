# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import now_datetime
from preciit.preciit.doctype.it_asset_item.it_asset_item import (
    get_document_trace,
    log_document_trace,
    update_asset_item_status,
)


class ITAssetDecommissioning(Document):

    # ======================
    # AFTER INSERT
    # ======================

    def autoname(self):
        date_part = now_datetime().strftime("%d-%m-%Y")
        self.name = make_autoname(f"ASSET-DECOM-{date_part}-.####")

    # ======================
    # AFTER INSERT
    # ======================

    def after_insert(self):

        self.log_initial_child_rows()


    # ======================
    # TRACE INITIAL CHILD ROWS
    # ======================

    def log_initial_child_rows(self):

        added = []
        reference_asset_item = _get_single_asset_item(
            self.it_asset_decommissioning
        )

        for row in self.it_asset_decommissioning or []:
            added.append(["it_asset_decommissioning", row.as_dict()])

        if not added:
            return

        log_document_trace(
            self.doctype,
            self.name,
            added=added,
            reference_doctype="IT Asset Item" if reference_asset_item else None,
            reference_name=reference_asset_item
        )

    # ======================
    # ON SUBMIT
    # ======================

    def on_submit(self):

        if not self.it_asset_decommissioning:
            return

        old_status = frappe.db.get_value(
            self.doctype,
            self.name,
            "status"
        )

        row_changed = []
        reference_asset_item = _get_single_asset_item(
            self.it_asset_decommissioning
        )

        for row in self.it_asset_decommissioning:

            if not row.it_asset_item:
                continue

            old_row_status = row.status

            # UPDATE IT ASSET ITEM STATUS
            update_asset_item_status(
                row.it_asset_item,
                "Decommissioned",
                reference_doctype=self.doctype,
                reference_name=self.name
            )

            # FORCE REFRESH IT ASSET ITEM AFTER STATUS UPDATE
            frappe.clear_document_cache(
                "IT Asset Item",
                row.it_asset_item
            )

            latest_asset_status = frappe.db.get_value(
                "IT Asset Item",
                row.it_asset_item,
                "status"
            )

            if latest_asset_status != "Decommissioned":
                frappe.throw(
                    _("IT Asset Item {0} status was not updated to Decommissioned")
                    .format(frappe.bold(row.it_asset_item))
                )

            # UPDATE CHILD TABLE STATUS
            row.db_set(
                "status",
                "Decommissioned",
                update_modified=False
            )

            _add_child_status_trace(
                row_changed,
                "it_asset_decommissioning",
                row,
                old_row_status,
                "Decommissioned"
            )

        # UPDATE PARENT STATUS
        self.db_set(
            "status",
            "Decommissioned",
            update_modified=False
        )

        log_document_trace(
            self.doctype,
            self.name,
            changed=[["status", old_status, "Decommissioned"]],
            row_changed=row_changed,
            reference_doctype="IT Asset Item" if reference_asset_item else None,
            reference_name=reference_asset_item
        )

    # ======================
    # ON CANCEL
    # ======================

    def on_cancel(self):

        if not self.it_asset_decommissioning:
            return

        old_status = frappe.db.get_value(
            self.doctype,
            self.name,
            "status"
        )
        reference_asset_item = _get_single_asset_item(
            self.it_asset_decommissioning
        )
        row_changed = []

        for row in self.it_asset_decommissioning:

            if not row.it_asset_item:
                continue

            old_row_status = row.status

            # UPDATE IT ASSET ITEM STATUS
            update_asset_item_status(
                row.it_asset_item,
                "Available",
                reference_doctype=self.doctype,
                reference_name=self.name
            )

            # AUTO REFRESH IT ASSET ITEM STATUS
            frappe.clear_document_cache(
                "IT Asset Item",
                row.it_asset_item
            )

            latest_asset_status = frappe.db.get_value(
                "IT Asset Item",
                row.it_asset_item,
                "status"
            )

            if latest_asset_status != "Available":
                frappe.throw(
                    _("IT Asset Item {0} status was not refreshed to Available")
                    .format(frappe.bold(row.it_asset_item))
                )

            # UPDATE CHILD TABLE STATUS
            row.db_set(
                "status",
                "Available",
                update_modified=False
            )

            _add_child_status_trace(
                row_changed,
                "it_asset_decommissioning",
                row,
                old_row_status,
                "Available"
            )

        # UPDATE PARENT STATUS
        self.db_set(
            "status",
            "Cancelled",
            update_modified=False
        )

        log_document_trace(
            self.doctype,
            self.name,
            changed=[["status", old_status, "Cancelled"]],
            row_changed=row_changed,
            reference_doctype="IT Asset Item" if reference_asset_item else None,
            reference_name=reference_asset_item
        )


@frappe.whitelist()
def get_asset_decommissioning_trace(asset_decommissioning):
    if not asset_decommissioning:
        frappe.throw("IT Asset Decommissioning is required")

    doc = frappe.get_doc(
        "IT Asset Decommissioning",
        asset_decommissioning
    )
    doc.check_permission("read")

    trace = get_document_trace(
        "IT Asset Decommissioning",
        doc.name
    )

    asset_names = [
        row.it_asset_item
        for row in doc.it_asset_decommissioning or []
        if row.it_asset_item
    ]
    asset_count = len(asset_names)

    return {
        "summary": [
            {
                "label": "Decommissioning",
                "value": doc.name
            },
            {
                "label": "Employee",
                "value": doc.employee_name
            },
            {
                "label": "Current Status",
                "value": doc.status
            },
            {
                "label": "Asset Name",
                "value": "\n".join(asset_names)
            },
            {
                "label": "Assets",
                "value": asset_count
            }
        ],
        "track_changes": trace.get("track_changes"),
        "events": trace.get("events", [])
    }


def _add_child_status_trace(row_changed, table_fieldname, row, old_status, new_status):
    if old_status == new_status:
        return

    row_changed.append([
        table_fieldname,
        row.idx - 1,
        row.name,
        [["status", old_status, new_status]]
    ])


def _get_single_asset_item(rows):
    asset_items = []

    for row in rows or []:
        asset_item = getattr(row, "it_asset_item", None)

        if asset_item and asset_item not in asset_items:
            asset_items.append(asset_item)

    return asset_items[0] if len(asset_items) == 1 else None
