# Copyright (c) 2026, Precihole Group and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


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

            if not row.it_asset_item:
                continue

            # UPDATE IT ASSET ITEM STATUS
            frappe.db.set_value(
                "IT Asset Item",
                row.it_asset_item,
                "status",
                "Decommissioned",
                update_modified=False
            )

            # UPDATE CHILD TABLE STATUS
            row.db_set(
                "status",
                "Decommissioned",
                update_modified=False
            )

        # UPDATE PARENT STATUS
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

            if not row.it_asset_item:
                continue

            # UPDATE IT ASSET ITEM STATUS
            frappe.db.set_value(
                "IT Asset Item",
                row.it_asset_item,
                "status",
                "Available",
                update_modified=False
            )

            # UPDATE CHILD TABLE STATUS
            row.db_set(
                "status",
                "Available",
                update_modified=False
            )

        # UPDATE PARENT STATUS
        self.db_set(
            "status",
            "Cancelled",
            update_modified=False
        )