# Copyright (c) 2026, Precihole Group and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname


class SoftwareConfiguration(Document):

    def validate(self):

        # ==============================
        # VALIDATE ASSET NAME
        # ==============================
        if not self.asset_name:
            frappe.throw("Asset Name is required")

        # ==============================
        # CHECK ASSET EXISTS
        # ==============================
        if not frappe.db.exists("Asset Item", self.asset_name):
            frappe.throw(
                f"Asset Item {self.asset_name} does not exist"
            )

    def on_submit(self):

        # ==============================
        # UPDATE ASSET STATUS
        # ==============================
        frappe.db.set_value(
            "Asset Item",
            self.asset_name,
            "status",
            "Software Configured"
        )

    # ======================
    # ON CANCEL
    # ======================
    def on_cancel(self):

        self.db_set(
            "status",
            "Cancelled",
            update_modified=False
        )

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
    