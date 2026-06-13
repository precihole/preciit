# Copyright (c) 2026, Shubham Mishra and contributors
# See license.txt

# import frappe
from types import SimpleNamespace

from frappe.tests.utils import FrappeTestCase

from preciit.preciit.doctype.it_asset_allocation import it_asset_allocation
from preciit.preciit.doctype.it_asset_item import it_asset_item


class TestITAssetAllocation(FrappeTestCase):
	def test_allocation_uses_trace_aware_asset_item_status_updater(self):
		self.assertIs(
			it_asset_allocation.update_asset_item_status,
			it_asset_item.update_asset_item_status,
		)

	def test_single_asset_item_reference_is_used_for_linked_trace(self):
		self.assertEqual(
			it_asset_allocation._get_single_asset_item([
				SimpleNamespace(it_asset_item="ASSET-001")
			]),
			"ASSET-001",
		)

	def test_multiple_asset_items_are_not_collapsed_to_one_trace_reference(self):
		self.assertIsNone(
			it_asset_allocation._get_single_asset_item([
				SimpleNamespace(it_asset_item="ASSET-001"),
				SimpleNamespace(it_asset_item="ASSET-002"),
			])
		)
