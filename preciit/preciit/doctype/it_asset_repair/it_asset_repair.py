# Copyright (c) 2026, Shubham and contributors
# For license information, please see license.txt


import frappe
from frappe.model.document import Document

import frappe
from frappe.model.document import Document


class ITAssetRepair(Document):


	# =========================================
	# VALIDATE
	# =========================================

	def validate(self):

		self.validate_completed_repair()



	# =========================================
	# ON SUBMIT
	# =========================================

	def on_submit(self):

		# Update Repair Status
		self.db_set(
			"status",
			"Under Repair",
			update_modified=False
		)

		# Update IT Asset Item Status
		if self.it_asset_item:

			frappe.db.set_value(
				"IT Asset Item",
				self.it_asset_item,
				"status",
				"Under Repair"
			)

			frappe.msgprint(
				"IT Asset Item moved to Under Repair"
			)



	# =========================================
	# COMPLETED REPAIR
	# =========================================

	def validate_completed_repair(self):

		# Submitted + Completed
		if (
			self.docstatus == 1 and
			self.status == "Completed"
		):

			# Asset mandatory
			if not self.it_asset_item:
				frappe.throw("IT Asset Item is required")

			# Update IT Asset Item Status
			frappe.db.set_value(
				"IT Asset Item",
				self.it_asset_item,
				"status",
				"Available"
			)

			frappe.msgprint(
				"IT Asset Item status updated to Available"
			)



	# =========================================
	# ON CANCEL
	# =========================================

	def on_cancel(self):

		# Asset exists
		if self.it_asset_item:

			# Update IT Asset Item Status
			frappe.db.set_value(
				"IT Asset Item",
				self.it_asset_item,
				"status",
				"Available"
			)

			frappe.msgprint(
				"IT Asset Item status reverted to Available"
			)

		# Update Current Repair Status
		self.db_set(
			"status",
			"Cancelled",
			update_modified=False
		)