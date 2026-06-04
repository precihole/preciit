# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname

from preciit.preciit.doctype.it_asset_item.it_asset_item import (
    _get_child_field_changes,
    _get_trace_log_value,
    _is_traceable_field,
    _trace_value,
    get_document_trace,
    log_document_trace,
    update_asset_item_status,
)

#

SOFTWARE_CONFIGURATION_STATUS_TABLES = (
    ("os_details", "IT Operating System Details"),
    ("software_details", "IT Software Configuration Item Details"),
)


class ITSoftwareConfiguration(Document):

    # ======================
    # VALIDATE
    # ======================
    def validate(self):

        # VALIDATE ASSET NAME
        if not self.it_asset_item:
            frappe.throw("Asset Item is required")

        # CHECK ASSET EXISTS
        if not frappe.db.exists("IT Asset Item", self.it_asset_item):
            frappe.throw(
                f"Asset Item {self.it_asset_item} does not exist"
            )

        self.validate_software_configuration_status_remark()

    # ======================
    # AFTER INSERT
    # ======================
    def after_insert(self):

        self.log_initial_child_rows()

    def on_change(self):
        self.validate_software_configuration_status_remark()
        self.log_software_configuration_update_trace()

    def log_software_configuration_update_trace(self):
        if self.flags.get("software_configuration_update_trace_logged"):
            return

        old_doc = self.get_doc_before_save()

        if not old_doc:
            return

        changed = self.get_software_configuration_field_changes(old_doc)
        added, removed, row_changed = self.get_software_configuration_child_table_changes(
            old_doc
        )

        log_document_trace(
            self.doctype,
            self.name,
            changed=changed,
            added=added,
            removed=removed,
            row_changed=row_changed,
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )
        self.flags.software_configuration_update_trace_logged = True


    def get_software_configuration_field_changes(self, old_doc):
        changed = []

        for df in self.meta.fields:
            if not _is_traceable_field(df):
                continue

            old_value = old_doc.get(df.fieldname)
            new_value = self.get(df.fieldname)

            if _trace_value(old_value) == _trace_value(new_value):
                continue

            old_log_value = _get_trace_log_value(old_value, df)
            new_log_value = _get_trace_log_value(new_value, df)

            if df.fieldtype == "Password" and old_log_value == new_log_value:
                new_log_value = "Changed"

            changed.append([
                df.fieldname,
                old_log_value,
                new_log_value
            ])

        return changed


    def get_software_configuration_child_table_changes(self, old_doc):
        added = []
        removed = []
        row_changed = []

        for table_df in self.meta.get_table_fields():
            table_fieldname = table_df.fieldname
            child_meta = frappe.get_meta(table_df.options)
            old_rows = {
                row.name: row
                for row in (old_doc.get(table_fieldname) or [])
                if row.name
            }
            current_rows = {
                row.name: row
                for row in (self.get(table_fieldname) or [])
                if row.name
            }

            for row in (self.get(table_fieldname) or []):
                old_row = old_rows.get(row.name)

                if not old_row:
                    added.append([
                        table_fieldname,
                        row.as_dict()
                    ])
                    continue

                field_changes = _get_child_field_changes(
                    child_meta,
                    old_row,
                    row
                )

                if field_changes:
                    row_changed.append([
                        table_fieldname,
                        frappe.utils.cint(row.idx) - 1,
                        row.name,
                        field_changes
                    ])

            for row_name, old_row in old_rows.items():
                if row_name in current_rows:
                    continue

                removed.append([
                    table_fieldname,
                    old_row.as_dict()
                ])

        return added, removed, row_changed


    # ======================
    # TRACE INITIAL CHILD ROWS
    # ======================
    def log_initial_child_rows(self):

        added = []

        for row in self.os_details or []:
            added.append(["os_details", row.as_dict()])

        for row in self.software_details or []:
            added.append(["software_details", row.as_dict()])

        if not added:
            return

        log_document_trace(
            self.doctype,
            self.name,
            added=added,
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )

    # ======================
    # ON SUBMIT
    # ======================
    def on_submit(self):

        old_status = frappe.db.get_value(
            self.doctype,
            self.name,
            "status"
        )

        # UPDATE ASSET ITEM STATUS
        update_asset_item_status(
            self.it_asset_item,
            "Available",
            reference_doctype=self.doctype,
            reference_name=self.name
        )

        # UPDATE CURRENT DOC STATUS
        self.flags.software_configuration_update_trace_logged = True
        self.db_set(
            "status",
            "Software Configured",
            update_modified=False
        )

        log_document_trace(
            self.doctype,
            self.name,
            changed=[["status", old_status, "Software Configured"]],
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )

    # ======================
    # ON CANCEL
    # ======================
    def on_cancel(self):

        validate_linked_asset_documents_cancelled(
            self.it_asset_item
        )

        # RESET ASSET STATUS
        if self.it_asset_item:

            update_asset_item_status(
                self.it_asset_item,
                "Instock",
                reference_doctype=self.doctype,
                reference_name=self.name
            )

        old_status = frappe.db.get_value(
            self.doctype,
            self.name,
            "status"
        )

        self.flags.software_configuration_update_trace_logged = True
        self.db_set(
            "status",
            "Cancelled",
            update_modified=False
        )

        log_document_trace(
            self.doctype,
            self.name,
            changed=[["status", old_status, "Cancelled"]],
            reference_doctype="IT Asset Item",
            reference_name=self.it_asset_item
        )


    def validate_software_configuration_status_remark(self):
        """
        Only on update:
        If status is changed in IT Software Configuration child table,
        remarks is mandatory only for that changed row.
        """

        # Skip new document insert
        if self.is_new():
            return

        old_doc = self.get_doc_before_save()

        for table_fieldname, child_doctype in SOFTWARE_CONFIGURATION_STATUS_TABLES:
            old_rows = self.get_previous_child_rows(
                old_doc,
                table_fieldname,
                child_doctype
            )

            for row in (self.get(table_fieldname) or []):
                old_row = old_rows.get(row.name)

                # Skip newly added child rows
                if not old_row:
                    continue

                old_status = frappe.utils.cstr(old_row.status)
                new_status = frappe.utils.cstr(row.status)
                remarks = frappe.utils.cstr(row.remarks).strip()

                # Child table status changed
                if old_status != new_status and not remarks:
                    table_label = self.meta.get_label(table_fieldname)
                    frappe.throw(
                        _(
                            "Remarks is mandatory in {0} row {1} "
                            "because Status changed from '{2}' to '{3}'."
                        ).format(
                            table_label,
                            row.idx,
                            old_status,
                            new_status
                        )
                    )


    def get_previous_child_rows(self, old_doc, table_fieldname, child_doctype):
        if old_doc:
            return {
                row.name: row
                for row in (old_doc.get(table_fieldname) or [])
                if row.name
            }

        return {
            row.name: row
            for row in frappe.get_all(
                child_doctype,
                filters={
                    "parent": self.name,
                    "parenttype": self.doctype,
                    "parentfield": table_fieldname
                },
                fields=["name", "status"]
            )
            if row.name
        }



def validate_linked_asset_documents_cancelled(asset_item):
    if not asset_item:
        return

    linked_documents = get_uncancelled_linked_asset_documents(
        asset_item
    )

    if not linked_documents:
        return

    linked_list = "<br>".join(
        "{0}: {1}".format(
            frappe.bold(doc["doctype"]),
            frappe.utils.get_link_to_form(
                doc["doctype"],
                doc["name"]
            )
        )
        for doc in linked_documents
    )

    frappe.throw(
        _(
            "Please cancel these linked documents for IT Asset Item {0} first, "
            "then cancel this Software Configuration:<br>{1}"
        ).format(
            frappe.bold(asset_item),
            linked_list
        )
    )


def get_uncancelled_linked_asset_documents(asset_item):
    linked_documents = []

    linked_documents.extend(
        get_child_linked_asset_documents(
            "IT Asset Decommissioning",
            "it_asset_decommissioning",
            asset_item
        )
    )

    linked_documents.extend(
        get_direct_linked_asset_documents(
            "IT Asset Repair",
            asset_item
        )
    )

    linked_documents.extend(
        get_child_linked_asset_documents(
            "IT Asset Allocation",
            "assigned_device",
            asset_item
        )
    )

    return linked_documents


def get_direct_linked_asset_documents(doctype, asset_item):
    return [
        {
            "doctype": doctype,
            "name": doc.name
        }
        for doc in frappe.get_all(
            doctype,
            filters={
                "it_asset_item": asset_item,
                "docstatus": ["!=", 2]
            },
            fields=["name"],
            order_by="modified desc"
        )
    ]


def get_child_linked_asset_documents(parent_doctype, parentfield, asset_item):
    child_rows = frappe.get_all(
        "IT System Configuration Item",
        filters={
            "parenttype": parent_doctype,
            "parentfield": parentfield,
            "it_asset_item": asset_item
        },
        fields=["parent"],
        order_by="idx asc"
    )

    parent_names = []
    seen = set()

    for row in child_rows:
        if not row.parent or row.parent in seen:
            continue

        seen.add(row.parent)
        parent_names.append(row.parent)

    if not parent_names:
        return []

    return [
        {
            "doctype": parent_doctype,
            "name": doc.name
        }
        for doc in frappe.get_all(
            parent_doctype,
            filters={
                "name": ["in", parent_names],
                "docstatus": ["!=", 2]
            },
            fields=["name"],
            order_by="modified desc"
        )
    ]


@frappe.whitelist()
def get_software_configuration_trace(software_configuration):
    if not software_configuration:
        frappe.throw("IT Software Configuration is required")

    doc = frappe.get_doc(
        "IT Software Configuration",
        software_configuration
    )
    doc.check_permission("read")

    trace = get_document_trace(
        "IT Software Configuration",
        doc.name
    )

    return {
        "software_configuration": doc.name,
        "it_asset_item": doc.it_asset_item,
        "current_status": doc.status,
        "track_changes": trace.get("track_changes"),
        "events": trace.get("events", [])
    }
