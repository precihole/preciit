# Copyright (c) 2026, Shubham Mishra and contributors
# See license.txt

# import frappe
from unittest.mock import Mock, patch

from frappe.tests.utils import FrappeTestCase

from preciit.preciit.doctype.it_asset_item.it_asset_item import update_asset_item_status


class TestITAssetItem(FrappeTestCase):
	@patch("preciit.preciit.doctype.it_asset_item.it_asset_item.frappe.publish_realtime")
	@patch("preciit.preciit.doctype.it_asset_item.it_asset_item.frappe.get_doc")
	@patch("preciit.preciit.doctype.it_asset_item.it_asset_item.frappe.clear_document_cache")
	@patch("preciit.preciit.doctype.it_asset_item.it_asset_item.log_asset_item_trace")
	@patch("preciit.preciit.doctype.it_asset_item.it_asset_item.frappe.db.set_value")
	@patch("preciit.preciit.doctype.it_asset_item.it_asset_item.frappe.db.get_value")
	def test_update_asset_item_status_notifies_open_asset_form(
		self,
		get_value,
		set_value,
		log_asset_item_trace,
		clear_document_cache,
		get_doc,
		publish_realtime,
	):
		asset_doc = Mock()
		get_value.return_value = "Available"
		get_doc.return_value = asset_doc

		update_asset_item_status(
			"ASSET-001",
			"Allocated",
			reference_doctype="IT Asset Allocation",
			reference_name="ALLOC-001",
		)

		set_value.assert_called_once_with(
			"IT Asset Item",
			"ASSET-001",
			"status",
			"Allocated",
			update_modified=True,
		)
		log_asset_item_trace.assert_called_once_with(
			"ASSET-001",
			changed=[["status", "Available", "Allocated"]],
			reference_doctype="IT Asset Allocation",
			reference_name="ALLOC-001",
		)
		clear_document_cache.assert_called_once_with(
			"IT Asset Item",
			"ASSET-001",
		)
		get_doc.assert_called_once_with(
			"IT Asset Item",
			"ASSET-001",
		)
		asset_doc.notify_update.assert_called_once_with()
		publish_realtime.assert_called_once_with(
			"doc_update",
			{
				"doctype": "IT Asset Item",
				"name": "ASSET-001",
			},
			doctype="IT Asset Item",
			docname="ASSET-001",
		)
