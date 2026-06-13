# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import now_datetime

from preciit.preciit.doctype.it_asset_item.it_asset_item import (
    get_document_trace,
    log_asset_item_child_row_added,
    log_asset_item_child_row_change,
    log_document_trace,
    update_asset_item_status,
)


class ITAssetRepair(Document):

    # =========================================
    # AUTONAME
    # =========================================


    def autoname(self):
        date_part = now_datetime().strftime("%d-%m-%y")
        self.name = make_autoname(f"ASSET-REP-{date_part}-.####")


    # =========================================
    # AFTER INSERT
    # =========================================

    def after_insert(self):

        self.log_initial_child_rows()

    # =========================================
    # TRACE INITIAL CHILD ROWS
    # =========================================

    def log_initial_child_rows(self):

        added = []

        for row in self.asset_repair_item_details or []:
            added.append(["asset_repair_item_details", row.as_dict()])

        for row in self.asset_replacement_item_details or []:
            added.append(["asset_replacement_item_details", row.as_dict()])

        if not added:
            return

        log_document_trace(
            self.doctype,
            self.name,
            added=added,
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )

    # =========================================
    # VALIDATE
    # =========================================

    def validate(self):

        if (
            self.docstatus == 0 and
            not self.status
        ):

            self.status = "Draft"

    # =========================================
    # ON SUBMIT
    # =========================================

    def on_submit(self):

        old_status = frappe.db.get_value(
            self.doctype,
            self.name,
            "status"
        )

        # UPDATE CURRENT DOC STATUS
        self.db_set(
            "status",
            "Under Repair",
            update_modified=False
        )

        log_document_trace(
            self.doctype,
            self.name,
            changed=[["status", old_status, "Under Repair"]],
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )

        # UPDATE IT ASSET ITEM STATUS
        if self.it_asset_item:

            update_asset_item_status(
                self.it_asset_item,
                "Under Repair",
                reference_doctype=self.doctype,
                reference_name=self.name
            )

            frappe.msgprint(
                _("IT Asset Item moved to Under Repair")
            )

    # =========================================
    # ON UPDATE AFTER SUBMIT
    # =========================================

    def on_update_after_submit(self):

        old_status = _get_before_save_value(self, "status")

        self.log_status_change(old_status, self.status)

        # COMPLETED REPAIR
        if self.status == "Completed":

            # ASSET MANDATORY
            if not self.it_asset_item:

                frappe.throw(
                    _("IT Asset Item is required")
                )

            # =========================================
            # UPDATE DEVICE CONFIGURATION CHILD TABLE
            # =========================================

            # GET IT ASSET ITEM DOC
            asset_doc = frappe.get_doc(
                "IT Asset Item",
                self.it_asset_item
            )

            # LOOP THROUGH REPAIR CHILD TABLE
            for row in self.asset_repair_item_details:

                # CHECK DEVICE CONFIGURATION ROW ID
                if row.device_configuration_row_id:

                    # LOOP THROUGH DEVICE CONFIGURATION
                    for device_row in asset_doc.device_configuration:

                        # MATCH CHILD TABLE ROW ID
                        if (
                            row.device_configuration_row_id
                            == device_row.name
                        ):

                            old_status = frappe.db.get_value(
                                "IT Device Configuration",
                                device_row.name,
                                "status"
                            )

                            # UPDATE STATUS
                            frappe.db.set_value(
                                "IT Device Configuration",
                                device_row.name,
                                "status",
                                row.status,
                                update_modified=False
                            )

                            if old_status != row.status:
                                log_asset_item_child_row_change(
                                    self.it_asset_item,
                                    "device_configuration",
                                    device_row.idx - 1,
                                    device_row.name,
                                    [["status", old_status, row.status]],
                                    reference_doctype=self.doctype,
                                    reference_name=self.name
                                )

            self.add_replacement_items()

            # UPDATE IT ASSET ITEM STATUS ONLY AFTER CHILD TABLE UPDATES SUCCEED
            update_asset_item_status(
                self.it_asset_item,
                "Available",
                reference_doctype=self.doctype,
                reference_name=self.name
            )

            frappe.msgprint(
                _("IT Asset Item status updated to Available")
            )

            return

        self.add_replacement_items()

    def add_replacement_items(self):

        # =========================================
        # ADD REPLACEMENT ITEMS
        # =========================================

        for d in self.asset_replacement_item_details:

            # ADD CHILD ROW DIRECTLY IN DATABASE
            replacement_row = frappe.get_doc({
                "doctype": "IT Device Configuration",
                "parent": self.it_asset_item,
                "parentfield": "device_configuration",
                "parenttype": "IT Asset Item",

                "device_configuration_row_id": d.name,

                "component_brand_name": d.component_brand_name,

                "component_type": d.component_type,

                "component_name": d.component_name,

                "component_category": d.component_category,

                "component_model": d.component_model,

                "component_serial_number": d.component_serial_number,

                "component_capacity": d.component_capacity,

                "component_speed": d.component_speed,

                "status": d.status,

                "component_warrenty__expiry": d.component_warrenty__expiry,

                "component_purchase_date": d.component_purchase_date,

                "component_condition": d.component_condition,

                "component_quantity": d.component_quantity,

                "component_specification": d.component_specification,

                "remarks": d.remarks

            }).insert(ignore_permissions=True)

            log_asset_item_child_row_added(
                self.it_asset_item,
                "device_configuration",
                replacement_row,
                reference_doctype=self.doctype,
                reference_name=self.name
            )

    # =========================================
    # ON CANCEL
    # =========================================

    def on_cancel(self):
        # CHECK LINKED IT ASSET DECOMMISSIONING CHILD TABLE BEFORE CANCELLING THIS DOC
        if self.it_asset_item:
            linked_decommissioning = None

            linked_rows = frappe.get_all(
                "IT System Configuration Item",
                filters={
                    "parenttype": "IT Asset Decommissioning",
                    "parentfield": "it_asset_decommissioning",
                    "it_asset_item": self.it_asset_item
                },
                fields=["parent"],
                distinct=True
            )

            for row in linked_rows:
                parent_docstatus = frappe.db.get_value(
                    "IT Asset Decommissioning",
                    row.parent,
                    "docstatus"
                )

                if parent_docstatus != 2:
                    linked_decommissioning = row.parent
                    break

            if linked_decommissioning:
                frappe.throw(
                    _(
                        "Please cancel linked IT Asset Decommissioning {0} first, "
                        "then cancel this document."
                    ).format(
                        frappe.bold(linked_decommissioning)
                    )
                )

        old_status = frappe.db.get_value(
            self.doctype,
            self.name,
            "status"
        )

        # UPDATE IT ASSET ITEM STATUS
        if self.it_asset_item:
            update_asset_item_status(
                self.it_asset_item,
                "Available",
                reference_doctype=self.doctype,
                reference_name=self.name
            )

            frappe.msgprint(
                _("IT Asset Item status reverted to Available")
            )

        # UPDATE CURRENT DOC STATUS
        self.db_set(
            "status",
            "Cancelled",
            update_modified=False
        )

        log_document_trace(
            self.doctype,
            self.name,
            changed=[["status", old_status, "Cancelled"]],
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )

    # =========================================
    # TRACE STATUS CHANGE
    # =========================================

    def log_status_change(self, old_status, new_status):

        if old_status is None or old_status == new_status:
            return

        log_document_trace(
            self.doctype,
            self.name,
            changed=[["status", old_status, new_status]],
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )





@frappe.whitelist()
def get_asset_repair_trace(asset_repair):
    if not asset_repair:
        frappe.throw(_("IT Asset Repair is required"))

    doc = frappe.get_doc(
        "IT Asset Repair",
        asset_repair
    )
    doc.check_permission("read")

    trace = get_document_trace(
        "IT Asset Repair",
        doc.name
    )

    repair_count = len(doc.asset_repair_item_details or [])
    replacement_count = len(doc.asset_replacement_item_details or [])

    return {
        "summary": [
            {
                "label": "Repair",
                "value": doc.name
            },
            {
                "label": "IT Asset Item",
                "value": doc.it_asset_item
            },
            {
                "label": "Current Status",
                "value": doc.status
            },
            {
                "label": "Items",
                "value": repair_count + replacement_count
            }
        ],
        "track_changes": trace.get("track_changes"),
        "events": trace.get("events", [])
    }


def _get_before_save_value(doc, fieldname):
    previous_doc = doc.get_doc_before_save()

    if not previous_doc:
        return None

    return previous_doc.get(fieldname)
