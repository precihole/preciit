import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
import re
from frappe import _


class AssetAllocation(Document):

    def autoname(self):

        # Employee Name
        employee = (
            self.employee_name or "EMP"
        ).replace(" ", "-").upper()

        # Current Year
        year = frappe.utils.now_datetime().year

        # Naming Series
        self.name = make_autoname(
            f"{employee}-{year}-.#####"
        )


    # ======================
    # VALIDATE
    # ======================
    def validate(self):

        if not self.assigned_device:
            return

        for row in self.assigned_device:

            if not row.asset:
                continue

            # ======================
            # CHECK CURRENT STATUS
            # ======================
            status = frappe.db.get_value(
                "Asset Item",
                row.asset,
                "status"
            )

            # ======================
            # ALREADY ALLOCATED
            # ======================
            if status == "Allocated":

                frappe.throw(
                    _("Asset {0} is already allocated to another employee")
                    .format(row.asset)
                )

    # ======================
    # ON SUBMIT
    # ======================
    def on_submit(self):

        if not self.assigned_device:
            return

        for row in self.assigned_device:

            if not row.asset:
                continue

            frappe.db.set_value(
                "Asset Item",
                row.asset,
                "status",
                "Allocated",
                update_modified=False
            )

             # UPDATE CHILD TABLE STATUS
            frappe.db.set_value(
                row.doctype,
                row.name,
                "status",
                "Allocated",
                update_modified=False
            )

            # ======================
            # UPDATE CURRENT DOC STATUS
            self.db_set(
                "status",
                "Allocated",
                update_modified=False
            )

    # ======================
    # ON CANCEL
    # ======================
    def on_cancel(self):

        if not self.assigned_device:
            return

        for row in self.assigned_device:

            if not row.asset:
                continue

            frappe.db.set_value(
                "Asset Item",
                row.asset,
                "status",
                "Available",
                update_modified=False
            )


@frappe.whitelist()
def deallocate_assets(docname):

    doc = frappe.get_doc(
        "Asset Allocation",
        docname
    )

    # ======================
    # VALIDATION
    # ======================
    if doc.docstatus != 1:
        frappe.throw("Only submitted documents can be deallocated")

    if doc.status != "Allocated":
        frappe.throw("Assets are already deallocated")

    if not doc.assigned_device:
        frappe.throw("No assigned devices found")

    # ======================
    # DEALLOCATE
    # ======================
    for row in doc.assigned_device:

        if not row.asset:
            continue

        # UPDATE ASSET ITEM STATUS
        frappe.db.set_value(
            "Asset Item",
            row.asset,
            "status",
            "Available",
            update_modified=False
        )

        # UPDATE CHILD TABLE STATUS
        frappe.db.set_value(
            row.doctype,
            row.name,
            "status",
            "Deallocated",
            update_modified=False
        )

    # ======================
    # UPDATE PARENT STATUS
    # ======================
    frappe.db.set_value(
        "Asset Allocation",
        doc.name,
        "status",
        "Deallocated",
        update_modified=False
    )

    frappe.db.commit()
