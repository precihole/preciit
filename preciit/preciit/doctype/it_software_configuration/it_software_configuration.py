# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname

#


class ITSoftwareConfiguration(Document):

    # ======================
    # VALIDATE
    # ======================
    def validate(self):

        # VALIDATE ASSET NAME
        if not self.asset_name:
            frappe.throw("Asset Name is required")

        # CHECK ASSET EXISTS
        if not frappe.db.exists("IT Asset Item", self.asset_name):
            frappe.throw(
                f"Asset Item {self.asset_name} does not exist"
            )

    # ======================
    # ON SUBMIT
    # ======================
    def on_submit(self):

        # UPDATE ASSET ITEM STATUS
        frappe.db.set_value(
            "IT Asset Item",
            self.asset_name,
            "status",
            "Available",
            update_modified=False
        )

        # UPDATE CURRENT DOC STATUS
        self.db_set(
            "status",
            "Software Configured",
            update_modified=False
        )

    # ======================
    # ON CANCEL
    # ======================
    def on_cancel(self):

        # RESET ASSET STATUS
        if self.asset_name:

            frappe.db.set_value(
                "IT Asset Item",
                self.asset_name,
                "status",
                "Instock",
                update_modified=False
            )