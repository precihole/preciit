# Copyright (c) 2026, Precihole Group and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ITAssetDecommissioning(Document):
    # ======================
    # ON SUBMIT
    # ======================

    def on_submit(self):

        if not self.it_asset_decommissioning:
            return

        for row in self.it_asset_decommissioning:

            if not row.asset:
                continue

            frappe.db.set_value(
                "IT Asset Item",
                row.asset,
                "status",
                "Decommissioned",
                update_modified=False
            )

             # UPDATE CHILD TABLE STATUS
            frappe.db.set_value(
                row.doctype,
                row.name,
                "status",
                "Decommissioned",
                update_modified=False
            )

            # ======================
            # UPDATE CURRENT DOC STATUS
            self.db_set(
                "status",
                "Decommissioned",
                update_modified=False
            )

    # ======================
    # ON CANCEL
    # ======================
    def on_cancel(self):

        if not self.it_asset_decommissioning:
            return

        for row in self.it_asset_decommissioning:

            if not row.asset:
                continue

            frappe.db.set_value(
                "IT Asset Item",
                row.asset,
                "status",
                "Available",
                update_modified=False
            )

