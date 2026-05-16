# Copyright (c) 2026, Precihole Group and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class AssetDecommissioning(Document):

    def on_submit(self):

        if not self.asset_decommissioning:
            return

        for row in self.asset_decommissioning:

            if not row.asset:
                continue

            frappe.db.set_value(
                "Asset Item",   # <-- confirm this doctype name
                row.asset,       # <-- correct field (must be the document name)
                "item_status",
                "Decommissioning",
                update_modified=False
            )