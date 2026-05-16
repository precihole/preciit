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
            if status == "Assigned":

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
                "Assigned",
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
                "Software Configured",
                update_modified=False
            )
   