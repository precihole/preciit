import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe import _


class ITAssetAllocation(Document):


	# ======================
	# AUTONAME
	# ======================

	def autoname(self):

		employee = (
			self.employee_name or "EMP"
		).replace(" ", "-").upper()

		year = frappe.utils.now_datetime().year

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

			if not row.it_asset_item:
				continue

			status = frappe.db.get_value(
				"IT Asset Item",
				row.it_asset_item,
				"status"
			)

			if status == "Allocated":

				frappe.throw(
					_("Asset {0} is already allocated")
					.format(row.it_asset_item)
				)



	# ======================
	# BEFORE SUBMIT
	# ======================

	def before_submit(self):

		if not self.assigned_device:
			return

		for row in self.assigned_device:

			if not row.it_asset_item:
				continue

			# UPDATE ASSET STATUS
			frappe.db.set_value(
				"IT Asset Item",
				row.it_asset_item,
				"status",
				"Allocated",
				update_modified=False
			)

			# UPDATE CHILD ROW STATUS
			frappe.db.set_value(
				row.doctype,
				row.name,
				"status",
				"Allocated",
				update_modified=False
			)

		# UPDATE PARENT STATUS
		self.status = "Allocated"



	# ======================
	# ON CANCEL
	# ======================

	def on_cancel(self):

		if not self.assigned_device:
			return

		for row in self.assigned_device:

			if not row.it_asset_item:
				continue

			# UPDATE ASSET STATUS
			frappe.db.set_value(
				"IT Asset Item",
				row.it_asset_item,
				"status",
				"Available",
				update_modified=False
			)

			# UPDATE CHILD ROW STATUS
			frappe.db.set_value(
				row.doctype,
				row.name,
				"status",
				"Deallocated",
				update_modified=False
			)

		# UPDATE PARENT STATUS
		self.db_set(
			"status",
			"Cancelled",
			update_modified=False
		)



# ======================
# DEALLOCATE FUNCTION
# ======================

@frappe.whitelist()
def deallocate_assets(docname):

	doc = frappe.get_doc(
		"IT Asset Allocation",
		docname
	)

	# VALIDATION
	if doc.docstatus != 1:

		frappe.throw(
			_("Only submitted documents can be deallocated")
		)

	if doc.status == "Deallocated":

		frappe.throw(
			_("Assets are already deallocated")
		)

	if not doc.assigned_device:

		frappe.throw(
			_("No assigned devices found")
		)

	# DEALLOCATE
	for row in doc.assigned_device:

		if not row.it_asset_item:
			continue

		# UPDATE ASSET STATUS
		frappe.db.set_value(
			"IT Asset Item",
			row.it_asset_item,
			"status",
			"Available",
			update_modified=False
		)

		# UPDATE CHILD ROW STATUS
		frappe.db.set_value(
			row.doctype,
			row.name,
			"status",
			"Deallocated",
			update_modified=False
		)

	# UPDATE PARENT STATUS
	frappe.db.set_value(
		"IT Asset Allocation",
		doc.name,
		"status",
		"Deallocated",
		update_modified=False
	)

	frappe.db.commit()