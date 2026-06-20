# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import frappe
import re
from frappe.model.document import Document
from frappe.model.naming import getseries
from frappe.utils import now_datetime


class ITAssetTransfer(Document):
	def autoname(self):
		date_part = now_datetime().strftime("%d-%m-%Y")
		series_key = "ASSET-TRANSFER-"

		self.sync_asset_transfer_series(series_key)
		series_number = getseries(series_key, 4)
		self.name = f"ASSET-TRANSFER-{date_part}-{series_number}"

	def sync_asset_transfer_series(self, series_key):
		max_existing = 0
		name_pattern = re.compile(r"-(\d+)$")

		for docname in frappe.get_all(
			self.doctype,
			filters={"name": ["like", "ASSET-TRANSFER-%"]},
			pluck="name",
		):
			suffix_match = name_pattern.search(docname)
			if suffix_match:
				max_existing = max(max_existing, int(suffix_match.group(1)))

		if not max_existing:
			return

		frappe.db.sql(
			"""
			INSERT INTO `tabSeries` (`name`, `current`)
			VALUES (%s, %s)
			ON DUPLICATE KEY UPDATE `current` = GREATEST(`current`, VALUES(`current`))
			""",
			(series_key, max_existing),
		)
