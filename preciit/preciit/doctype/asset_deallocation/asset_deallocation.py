import frappe
from frappe.model.document import Document





# class AssetDeallocation(Document):

#     def on_submit(self):

#         if not self.device_deallocation:
#             return

#         for row in self.device_deallocation:

#             if not row.asset:
#                 continue

#             # ======================
#             # UPDATE ASSET STATUS
#             # ======================
#             frappe.db.set_value(
#                 "Asset Item",
#                 row.asset,
#                 "status",
#                 "Software Configured",
#                 update_modified=False
#             )

#             # ======================
#             # FIND ASSET ALLOCATION
#             # ======================
#             allocations = frappe.get_all(
#                 "Assigned Device",
#                 filters={
#                     "asset": row.asset
#                 },
#                 fields=["name", "parent"]
#             )

#             # ======================
#             # REMOVE DEVICE
#             # ======================
#             for d in allocations:

#                 allocation_doc = frappe.get_doc(
#                     "Asset Allocation",
#                     d.parent
#                 )

#                 allocation_doc.assigned_device = [
#                     x for x in allocation_doc.assigned_device
#                     if x.asset != row.asset
#                 ]

#                 # Auto Save
#                 allocation_doc.save(
#                     ignore_permissions=True
#                 )

#         frappe.db.commit()



import frappe
from frappe.model.document import Document


class AssetDeallocation(Document):

    # ======================
    # ON SUBMIT
    # ======================
    def on_submit(self):

        if not self.device_deallocation:
            return

        for row in self.device_deallocation:

            if not row.asset:
                continue

            # ======================
            # UPDATE ASSET STATUS
            # ======================
            frappe.db.set_value(
                "Asset Item",
                row.asset,
                "status",
                "Software Configured",
                update_modified=False
            )

            # ======================
            # FIND ASSET ALLOCATION
            # ======================
            allocations = frappe.get_all(
                "System Configuration Item",
                filters={
                    "asset": row.asset,
                    "parenttype": "Asset Allocation"
                },
                fields=["parent"]
            )

            # ======================
            # REMOVE DEVICE
            # ======================
            for d in allocations:

                # Skip missing docs
                if not frappe.db.exists(
                    "Asset Allocation",
                    d.parent
                ):
                    continue

                allocation_doc = frappe.get_doc(
                    "Asset Allocation",
                    d.parent
                )

                # ======================
                # REMOVE MATCHING DEVICE
                # ======================
                updated_rows = []

                for device in allocation_doc.assigned_device:

                    if device.asset != row.asset:
                        updated_rows.append(device)

                # Update child table
                allocation_doc.assigned_device = updated_rows

                # ======================
                # NO DEVICES LEFT
                # ======================
                if not updated_rows:

                    if allocation_doc.docstatus == 1:
                        allocation_doc.cancel()

                else:

                    allocation_doc.save(
                        ignore_permissions=True
                    )

        frappe.db.commit()

    # ======================
    # ON CANCEL
    # ======================
    def on_cancel(self):

        if not self.device_deallocation:
            return

        for row in self.device_deallocation:

            if not row.asset:
                continue

            # ======================
            # RESTORE ASSET STATUS
            # ======================
            frappe.db.set_value(
                "Asset Item",
                row.asset,
                "status",
                "Assigned",
                update_modified=False
            )

            # ======================
            # FIND ASSET ALLOCATION
            # ======================
            allocations = frappe.get_all(
                "System Configuration Item",
                filters={
                    "asset": row.asset,
                    "parenttype": "Asset Allocation"
                },
                fields=["parent"]
            )

            for d in allocations:

                if not frappe.db.exists(
                    "Asset Allocation",
                    d.parent
                ):
                    continue

                allocation_doc = frappe.get_doc(
                    "Asset Allocation",
                    d.parent
                )

                # ======================
                # CHECK EXISTS
                # ======================
                exists = False

                for device in allocation_doc.assigned_device:

                    if device.asset == row.asset:
                        exists = True
                        break

                # ======================
                # RE-ADD DEVICE
                # ======================
                if not exists:

                    allocation_doc.append(
                        "assigned_device",
                        {
                            "asset": row.asset
                        }
                    )

                    allocation_doc.save(
                        ignore_permissions=True
                    )

        frappe.db.commit()