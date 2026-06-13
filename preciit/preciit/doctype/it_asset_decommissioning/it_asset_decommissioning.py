# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import frappe
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

        for row in self.it_asset_decommissioning or []:
            added.append(["it_asset_decommissioning", row.as_dict()])

        if not added:
            return

        log_document_trace(
            self.doctype,
            self.name,
            added=added
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
            row_changed=row_changed
        )

    def update_asset_item_status(
        it_asset_item,
        status,
        reference_doctype=None,
        reference_name=None
    ):
        frappe.db.set_value(
            "IT Asset Item",
            it_asset_item,
            {
                "status": status,
                "reference_doctype": reference_doctype,
                "reference_name": reference_name
            },
            update_modified=True
        )

        frappe.clear_document_cache(
            "IT Asset Item",
            it_asset_item
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
            row_changed=row_changed
        )
# HELPER FUNCTIONS
def update_asset_item_status(
    it_asset_item,
    status,
    reference_doctype=None,
    reference_name=None
):
    values = {
        "status": status
    }

    meta = frappe.get_meta("IT Asset Item")

    if meta.has_field("reference_doctype"):
        values["reference_doctype"] = reference_doctype

    if meta.has_field("reference_name"):
        values["reference_name"] = reference_name

    frappe.db.set_value(
        "IT Asset Item",
        it_asset_item,
        values,
        update_modified=True
    )

    frappe.clear_document_cache(
        "IT Asset Item",
        it_asset_item
    )

    asset_doc = frappe.get_doc(
        "IT Asset Item",
        it_asset_item
    )

    asset_doc.notify_update()

    frappe.publish_realtime(
        "doc_update",
        {
            "doctype": "IT Asset Item",
            "name": it_asset_item
        },
        doctype="IT Asset Item",
        docname=it_asset_item
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
