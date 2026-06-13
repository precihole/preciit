# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.model.naming import make_autoname
from frappe.utils import now_datetime

from preciit.preciit.doctype.it_asset_item.it_asset_item import (
    get_document_trace,
    log_document_trace,
    update_asset_item_status,
)


class ITAssetAllocation(Document):

    # ======================
    # AUTONAME
    # ======================

   
    def autoname(self):
        employee = (self.employee_name or "EMPLOYEE").strip().upper().replace(" ", "-")
        date_part = now_datetime().strftime("%d-%m-%Y")

        self.name = make_autoname(f"{employee}-{date_part}-.####")

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

        for row in self.assigned_device or []:
            added.append(["assigned_device", row.as_dict()])

        if not added:
            return

        log_document_trace(
            self.doctype,
            self.name,
            added=added
        )



    # ======================
    # VALIDATE
    # ======================

    def validate(self):

        if not self.assigned_device:
            return

        for row in self.assigned_device:

            if not row.it_asset_item:
                continue

            status = frappe.db.get_value(
                "IT Asset Item",
                row.it_asset_item,
                "status"
            )

            if status == "Allocated":

                frappe.throw(
                    _("Asset {0} is already allocated")
                    .format(row.it_asset_item)
                )



    # ======================
    # BEFORE SUBMIT
    # ======================

    def before_submit(self):

        if not self.assigned_device:
            return

        row_changed = []

        for row in self.assigned_device:

            if not row.it_asset_item:
                continue

            old_row_status = row.status

            # UPDATE IT ASSET ITEM STATUS
            update_asset_item_status(
                row.it_asset_item,
                "Allocated",
                reference_doctype=self.doctype,
                reference_name=self.name
            )

            # REFRESH IT ASSET ITEM CACHE
            frappe.clear_document_cache(
                "IT Asset Item",
                row.it_asset_item
            )

            latest_asset_status = frappe.db.get_value(
                "IT Asset Item",
                row.it_asset_item,
                "status"
            )

            if latest_asset_status != "Allocated":
                frappe.throw(
                    _("IT Asset Item {0} status was not updated to Allocated")
                    .format(frappe.bold(row.it_asset_item))
                )

            # UPDATE CHILD TABLE STATUS
            row.db_set(
                "status",
                "Allocated",
                update_modified=False
            )

            _add_child_status_trace(
                row_changed,
                "assigned_device",
                row,
                old_row_status,
                "Allocated"
            )

        # UPDATE PARENT STATUS
        self.status = "Allocated"

        log_document_trace(
            self.doctype,
            self.name,
            row_changed=row_changed
        )


    # ======================
    # ON CANCEL
    # ======================

    def on_cancel(self):

        if not self.assigned_device:
            return

        old_status = frappe.db.get_value(
            self.doctype,
            self.name,
            "status"
        )
        row_changed = []

        for row in self.assigned_device:

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

            # REFRESH IT ASSET ITEM CACHE
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
                    _("IT Asset Item {0} status was not updated to Available")
                    .format(frappe.bold(row.it_asset_item))
                )

            # UPDATE CHILD TABLE STATUS
            row.db_set(
                "status",
                "Deallocated",
                update_modified=False
            )

            _add_child_status_trace(
                row_changed,
                "assigned_device",
                row,
                old_row_status,
                "Deallocated"
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

#HELPER FUNCTION

def update_asset_item_status(
    it_asset_item,
    status,
    reference_doctype=None,
    reference_name=None
):
    values = {
        "status": status
    }

    # ADD REFERENCE FIELDS ONLY IF THEY EXIST IN IT ASSET ITEM
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
# ======================
# DEALLOCATE FUNCTION
# ======================

@frappe.whitelist()
def deallocate_assets(docname):

	doc = frappe.get_doc(
		"IT Asset Allocation",
		docname
	)

	# VALIDATION
	if doc.docstatus != 1:

		frappe.throw(
			_("Only submitted documents can be deallocated")
		)

	if doc.status == "Deallocated":

		frappe.throw(
			_("Assets are already deallocated")
		)

	if not doc.assigned_device:

		frappe.throw(
			_("No assigned devices found")
		)

	old_status = doc.status
	row_changed = []

	# DEALLOCATE
	for row in doc.assigned_device:

		if not row.it_asset_item:
			continue

		old_row_status = row.status

		# UPDATE ASSET STATUS
		update_asset_item_status(
			row.it_asset_item,
			"Available",
			reference_doctype=doc.doctype,
			reference_name=doc.name
		)

		# UPDATE CHILD ROW STATUS
		frappe.db.set_value(
			row.doctype,
			row.name,
			"status",
			"Deallocated",
			update_modified=False
		)

		_add_child_status_trace(
			row_changed,
			"assigned_device",
			row,
			old_row_status,
			"Deallocated"
		)

	# UPDATE PARENT STATUS
	frappe.db.set_value(
		"IT Asset Allocation",
		doc.name,
		"status",
		"Deallocated",
		update_modified=False
	)

	log_document_trace(
		doc.doctype,
		doc.name,
		changed=[["status", old_status, "Deallocated"]],
		row_changed=row_changed
	)

	frappe.db.commit()


@frappe.whitelist()
def get_asset_allocation_trace(asset_allocation):
    if not asset_allocation:
        frappe.throw(_("IT Asset Allocation is required"))

    doc = frappe.get_doc(
        "IT Asset Allocation",
        asset_allocation
    )
    doc.check_permission("read")

    trace = get_document_trace(
        "IT Asset Allocation",
        doc.name
    )

    asset_count = len([
        row
        for row in doc.assigned_device or []
        if row.it_asset_item
    ])

    return {
        "summary": [
            {
                "label": "Allocation",
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
