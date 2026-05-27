# Copyright (c) 2026, Shubham and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


# class ITAssetRepair(Document):


#     # =========================================
#     # VALIDATE
#     # =========================================

#     def validate(self):

#         if (
#             self.docstatus == 0 and
#             not self.status
#         ):

#             self.status = "Draft"



#     # =========================================
#     # ON SUBMIT
#     # =========================================

#     def on_submit(self):

#         # UPDATE CURRENT DOC STATUS
#         self.db_set(
#             "status",
#             "Under Repair",
#             update_modified=False
#         )

#         # UPDATE IT ASSET ITEM STATUS
#         if self.it_asset_item:

#             frappe.db.set_value(
#                 "IT Asset Item",
#                 self.it_asset_item,
#                 "status",
#                 "Under Repair",
#                 update_modified=False
#             )

#             frappe.msgprint(
#                 _("IT Asset Item moved to Under Repair")
#             )



#     # =========================================
#     # ON UPDATE AFTER SUBMIT
#     # =========================================

#     # def on_update_after_submit(self):

#     #     # COMPLETED REPAIR
#     #     if self.status == "Completed":

#     #         # ASSET MANDATORY
#     #         if not self.it_asset_item:

#     #             frappe.throw(
#     #                 _("IT Asset Item is required")
#     #             )

#     #         # UPDATE IT ASSET ITEM STATUS
#     #         frappe.db.set_value(
#     #             "IT Asset Item",
#     #             self.it_asset_item,
#     #             "status",
#     #             "Available",
#     #             update_modified=False
#     #         )

#     #         frappe.msgprint(
#     #             _("IT Asset Item status updated to Available")
#     #         )
    

# 	# =========================================
# 	# ON UPDATE AFTER SUBMIT
# 	# =========================================

# 	def on_update_after_submit(self):

# 		# COMPLETED REPAIR
# 		if self.status == "Completed":

# 			# ASSET MANDATORY
# 			if not self.it_asset_item:

# 				frappe.throw(
# 					_("IT Asset Item is required")
# 				)

# 			# UPDATE IT ASSET ITEM STATUS
# 			frappe.db.set_value(
# 				"IT Asset Item",
# 				self.it_asset_item,
# 				"status",
# 				"Available",
# 				update_modified=False
# 			)

# 			# =========================================
# 			# UPDATE DEVICE CONFIGURATION CHILD TABLE
# 			# =========================================

# 			# CHECK CHILD TABLE ROW NAME
# 			if self.device_configuration_row_name:

# 				# GET CHILD TABLE ROW
# 				child_doc = frappe.db.get_value(
# 					"Device Configuration",
# 					{
# 						"name": self.device_configuration_row_name,
# 						"parent": self.it_asset_item,
# 						"parenttype": "IT Asset Item"
# 					},
# 					"name"
# 				)

# 				# IF MATCH FOUND
# 				if child_doc:

# 					# UPDATE CHILD TABLE STATUS
# 					frappe.db.set_value(
# 						"Device Configuration",
# 						self.device_configuration_row_name,
# 						"status",
# 						self.status,
# 						update_modified=False
# 					)

# 			frappe.msgprint(
# 				_("IT Asset Item status updated to Available")
# 			)



#     # =========================================
#     # ON CANCEL
#     # =========================================

#     def on_cancel(self):

#         # UPDATE IT ASSET ITEM STATUS
#         if self.it_asset_item:

#             frappe.db.set_value(
#                 "IT Asset Item",
#                 self.it_asset_item,
#                 "status",
#                 "Available",
#                 update_modified=False
#             )

#             frappe.msgprint(
#                 _("IT Asset Item status reverted to Available")
#             )

#         # UPDATE CURRENT DOC STATUS
#         self.db_set(
#             "status",
#             "Cancelled",
#             update_modified=False
#         )




# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt
import frappe
from frappe import _
from frappe.model.document import Document


class ITAssetRepair(Document):

    # =========================================
    # VALIDATE
    # =========================================

    def validate(self):

        if (
            self.docstatus == 0 and
            not self.status
        ):

            self.status = "Draft"

    # =========================================
    # ON SUBMIT
    # =========================================

    def on_submit(self):

        # UPDATE CURRENT DOC STATUS
        self.db_set(
            "status",
            "Under Repair",
            update_modified=False
        )

        # UPDATE IT ASSET ITEM STATUS
        if self.it_asset_item:

            frappe.db.set_value(
                "IT Asset Item",
                self.it_asset_item,
                "status",
                "Under Repair",
                update_modified=False
            )

            frappe.msgprint(
                _("IT Asset Item moved to Under Repair")
            )

    # =========================================
    # ON UPDATE AFTER SUBMIT
    # =========================================

    def on_update_after_submit(self):

        # COMPLETED REPAIR
        if self.status == "Completed":

            # ASSET MANDATORY
            if not self.it_asset_item:

                frappe.throw(
                    _("IT Asset Item is required")
                )

            # UPDATE IT ASSET ITEM STATUS
            frappe.db.set_value(
                "IT Asset Item",
                self.it_asset_item,
                "status",
                "Available",
                update_modified=False
            )

            # =========================================
            # UPDATE DEVICE CONFIGURATION CHILD TABLE
            # =========================================

            # GET IT ASSET ITEM DOC
            asset_doc = frappe.get_doc(
                "IT Asset Item",
                self.it_asset_item
            )

            # LOOP THROUGH REPAIR CHILD TABLE
            for row in self.asset_repair_item_details:

                # CHECK DEVICE CONFIGURATION ROW NAME
                if row.device_configuration_row_name:

                    # LOOP THROUGH DEVICE CONFIGURATION
                    for device_row in asset_doc.device_configuration:

                        # MATCH CHILD TABLE ROW NAME
                        if (
                            row.device_configuration_row_name
                            == device_row.name
                        ):

                            # UPDATE STATUS
                            frappe.db.set_value(
                                "IT Device Configuration",
                                device_row.name,
                                "status",
                                row.status,
                                update_modified=False
                            )

            frappe.msgprint(
                _("IT Asset Item status updated to Available")
            )

        # =========================================
        # ADD REPLACEMENT ITEMS
        # =========================================

        for d in self.asset_replacement_item_details:

            # ADD CHILD ROW DIRECTLY IN DATABASE
            frappe.get_doc({
                "doctype": "IT Device Configuration",
                "parent": self.it_asset_item,
                "parentfield": "device_configuration",
                "parenttype": "IT Asset Item",

                "device_configuration_row_name": d.name,

                "component_brand_name": d.component_brand_name,

                "component_type": d.component_type,

                "component_name": d.component_name,

                "component_category": d.component_category,

                "component_model": d.component_model,

                "component_serial_number": d.component_serial_number,

                "component_capacity": d.component_capacity,

                "component_speed": d.component_speed,

                "status": d.status,

                "component_warrenty__expiry": d.component_warrenty__expiry,

                "component_purchase_date": d.component_purchase_date,

                "component_condition": d.component_condition,

                "component_quantity": d.component_quantity,

                "component_specification": d.component_specification,

                "remarks": d.remarks

            }).insert(ignore_permissions=True)

    # =========================================
    # ON CANCEL
    # =========================================

    def on_cancel(self):

        # UPDATE IT ASSET ITEM STATUS
        if self.it_asset_item:

            frappe.db.set_value(
                "IT Asset Item",
                self.it_asset_item,
                "status",
                "Available",
                update_modified=False
            )

            frappe.msgprint(
                _("IT Asset Item status reverted to Available")
            )

        # UPDATE CURRENT DOC STATUS
        self.db_set(
            "status",
            "Cancelled",
            update_modified=False
        )