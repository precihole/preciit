# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import frappe
import re
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import getseries
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
        series_key = "IT-ASSET-ALLOCATION-"

        self.sync_asset_allocation_series(series_key)
        series_number = getseries(series_key, 4)
        self.name = f"{employee}-{date_part}-{series_number}"

    def sync_asset_allocation_series(self, series_key):
        max_existing = 0
        name_pattern = re.compile(r"-(\d+)$")

        for docname in frappe.get_all(
            self.doctype,
            pluck="name",
        ):
            suffix_match = name_pattern.search(docname)
            if suffix_match:
                max_existing = max(max_existing, int(suffix_match.group(1)))

        if not max_existing:
            return

        frappe.db.sql(
            """
            INSERT INTO `tabSeries` (`name`, `current`)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE `current` = GREATEST(`current`, VALUES(`current`))
            """,
            (series_key, max_existing),
        )

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
            self.assigned_device
        )

        for row in self.assigned_device or []:
            added.append(["assigned_device", row.as_dict()])

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

        reference_asset_item = _get_single_asset_item(
            self.assigned_device
        )
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
            changed=[["status", old_status, "Allocated"]],
            row_changed=row_changed,
            reference_doctype="IT Asset Item" if reference_asset_item else None,
            reference_name=reference_asset_item
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
        reference_asset_item = _get_single_asset_item(
            self.assigned_device
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
            row_changed=row_changed,
            reference_doctype="IT Asset Item" if reference_asset_item else None,
            reference_name=reference_asset_item
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
	reference_asset_item = _get_single_asset_item(
		doc.assigned_device
	)
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
		row_changed=row_changed,
		reference_doctype="IT Asset Item" if reference_asset_item else None,
		reference_name=reference_asset_item
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


def _get_single_asset_item(rows):
    asset_items = []

    for row in rows or []:
        asset_item = getattr(row, "it_asset_item", None)

        if asset_item and asset_item not in asset_items:
            asset_items.append(asset_item)

    return asset_items[0] if len(asset_items) == 1 else None
