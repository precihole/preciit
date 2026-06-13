# Copyright (c) 2026, Shubham Mishra and contributors
# See license.txt

from types import SimpleNamespace
from unittest.mock import Mock, patch

import frappe
from frappe.tests.utils import FrappeTestCase


class TestITAssetRepair(FrappeTestCase):
	@patch("preciit.preciit.doctype.it_asset_repair.it_asset_repair.log_document_trace")
	def test_status_change_trace_links_it_asset_item(self, log_document_trace):
		doc = frappe.get_doc({
			"doctype": "IT Asset Repair",
			"name": "ASSET-REP-001",
			"it_asset_item": "ASSET-001",
		})

		doc.log_status_change("Under Repair", "Completed")

		log_document_trace.assert_called_once_with(
			"IT Asset Repair",
			"ASSET-REP-001",
			changed=[["status", "Under Repair", "Completed"]],
			reference_doctype="IT Asset Item",
			reference_name="ASSET-001",
		)

	def test_asset_item_not_marked_available_when_child_update_fails(self):
		doc = frappe.get_doc({
			"doctype": "IT Asset Repair",
			"name": "ASSET-REP-001",
			"it_asset_item": "ASSET-001",
			"status": "Completed",
			"asset_repair_item_details": [
				{
					"doctype": "IT Asset Repair Item",
					"device_configuration_row_id": "CFG-001",
					"status": "Repaired",
				}
			],
			"asset_replacement_item_details": [],
		})
		doc.get_doc_before_save = Mock(return_value=None)

		with (
			patch("preciit.preciit.doctype.it_asset_repair.it_asset_repair.frappe.get_doc") as get_doc,
			patch("preciit.preciit.doctype.it_asset_repair.it_asset_repair.frappe.db.get_value") as get_value,
			patch("preciit.preciit.doctype.it_asset_repair.it_asset_repair.frappe.db.set_value") as set_value,
			patch("preciit.preciit.doctype.it_asset_repair.it_asset_repair.frappe.msgprint") as msgprint,
			patch(
				"preciit.preciit.doctype.it_asset_repair.it_asset_repair.update_asset_item_status"
			) as update_asset_item_status,
		):
			get_doc.return_value = SimpleNamespace(
				device_configuration=[
					SimpleNamespace(
						name="CFG-001",
						idx=1,
					)
				]
			)
			get_value.return_value = "Under Repair"
			set_value.side_effect = Exception("child update failed")

			with self.assertRaisesRegex(Exception, "child update failed"):
				doc.on_update_after_submit()

			update_asset_item_status.assert_not_called()
			msgprint.assert_not_called()

	def test_asset_item_not_marked_available_when_replacement_insert_fails(self):
		doc = frappe.get_doc({
			"doctype": "IT Asset Repair",
			"name": "ASSET-REP-001",
			"it_asset_item": "ASSET-001",
			"status": "Completed",
			"asset_repair_item_details": [],
			"asset_replacement_item_details": [
				{
					"doctype": "IT Asset Repair Replace Item",
					"component_brand_name": "Brand",
					"component_type": "Type",
					"component_name": "Component",
					"component_category": "Hardware",
					"component_model": "Model",
					"component_serial_number": "Serial",
					"component_capacity": "1",
					"component_speed": "1",
					"status": "Active",
					"component_quantity": "1",
					"component_specification": "Spec",
					"remarks": "Remarks",
				}
			],
		})
		doc.get_doc_before_save = Mock(return_value=None)
		replacement_doc = Mock()
		replacement_doc.insert.side_effect = Exception("replacement insert failed")

		with (
			patch("preciit.preciit.doctype.it_asset_repair.it_asset_repair.frappe.get_doc") as get_doc,
			patch("preciit.preciit.doctype.it_asset_repair.it_asset_repair.frappe.msgprint") as msgprint,
			patch(
				"preciit.preciit.doctype.it_asset_repair.it_asset_repair.update_asset_item_status"
			) as update_asset_item_status,
		):
			get_doc.side_effect = [
				SimpleNamespace(device_configuration=[]),
				replacement_doc,
			]

			with self.assertRaisesRegex(Exception, "replacement insert failed"):
				doc.on_update_after_submit()

			update_asset_item_status.assert_not_called()
			msgprint.assert_not_called()
