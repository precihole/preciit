# Copyright (c) 2026, Shubham Mishra and contributors
# # For license information, please see license.txt

# class ITAssetItem(Document):
# 	pass


# Copyright (c) 2026, Shubham Mishra and contributors
# For license information, please see license.txt

import ipaddress
from unicodedata import name
import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
import re
from frappe import _
import frappe
from frappe.model.naming import make_autoname
from frappe.utils import now_datetime


class ITAssetItem(Document):

    # =========================================================
    # AUTONAME
    # =========================================================


    def autoname(self):
        # 1. Validate and Fetch Company Abbreviation
        if not getattr(self, "company", None):
            frappe.throw(
                msg="Please select a <b>Company</b> before saving this asset.",
                title="Missing Company Name"
            )

        company_abbr = frappe.db.get_value("Company", self.company, "abbr")

        # If company exists but has no abbreviation, throw error with link
        if not company_abbr:
            company_url = frappe.utils.get_url_to_form("Company", self.company)
            frappe.throw(
                msg=f"The selected company does not have an abbreviation setup. "
                    f"Please <a href='{company_url}' target='_blank'><b>click here</b></a> "
                    f"to add an abbreviation to the Company master first.",
                title="Missing Company Abbreviation"
            )

        # 2. Validate Device Type
        if not getattr(self, "device_type", None):
            frappe.throw(
                msg="<b>Device Type</b> is required. Please select or create a Device Type first.",
                title="Missing Device Type"
            )

        device_type = (
            self.device_type
            .strip()
            .upper()
            .replace(" ", "-")
        )

        # 3. Get current date and format as DD-MM-YYYY
        current_date = frappe.utils.now_datetime()
        date_part = current_date.strftime("%d-%m-%Y")

        # 4. Generate the final asset name with 4-digit series numbering
        self.name = make_autoname(
            f"{company_abbr}-{device_type}-{date_part}-.####"
        )

    # =========================================================
    # BEFORE SAVE
    # =========================================================
    def before_save(self):

        # CLEAN SERIAL NUMBER
        if self.serial_no:
            self.serial_no = (
                self.serial_no
                .strip()
                .upper()
            )

    # =========================================================
    # AFTER INSERT
    # =========================================================
    def after_insert(self):

        self.log_initial_child_rows()

    # =========================================================
    # TRACE INITIAL CHILD ROWS
    # =========================================================
    def log_initial_child_rows(self):

        added = []

        for row in self.device_configuration or []:
            added.append(["device_configuration", row.as_dict()])

        for row in self.network_interface_controller or []:
            added.append(["network_interface_controller", row.as_dict()])

        if not added:
            return

        log_asset_item_trace(
            self.name,
            added=added
        )

    # =========================================================
    # VALIDATE
    # =========================================================
    def validate(self):

        self.validate_serial_number()
        self.validate_network_interfaces()
        self.validate_device_configuration_status_remark()


    def on_update(self):
        self.log_asset_item_update_trace()


    def on_update_after_submit(self):
        self.log_asset_item_update_trace()


    def on_change(self):
        self.validate_device_configuration_status_remark()
        self.log_asset_item_update_trace()


    def log_asset_item_update_trace(self):
        if self.flags.get("asset_item_update_trace_logged"):
            return

        old_doc = self.get_doc_before_save()

        if not old_doc:
            return

        changed = self.get_asset_item_field_changes(old_doc)
        added, removed, row_changed = self.get_asset_item_child_table_changes(
            old_doc
        )

        log_asset_item_trace(
            self.name,
            changed=changed,
            added=added,
            removed=removed,
            row_changed=row_changed
        )
        self.flags.asset_item_update_trace_logged = True


    def get_asset_item_field_changes(self, old_doc):
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


    def get_asset_item_child_table_changes(self, old_doc):
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


    # =========================================================
    # SERIAL NUMBER VALIDATION
    # =========================================================
    def validate_serial_number(self):

        if not self.serial_no:
            return

        existing_asset = frappe.db.exists(
            "IT Asset Item",
            {
                "serial_no": self.serial_no,
                "name": ["!=", self.name]
            }
        )

        if existing_asset:

            frappe.throw(
                _(
                    "Serial Number already exists "
                    "in IT Asset Item: {0}"
                ).format(existing_asset)
            )

    # =========================================================
    # NETWORK INTERFACE VALIDATION
    # =========================================================
    def validate_network_interfaces(self):

        mac_regex = re.compile(
            r"^([0-9A-F]{2}:){5}[0-9A-F]{2}$",
            re.I
        )

        ipv4_regex = re.compile(
            r"^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)"
            r"(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$"
        )

        mac_list = []

        for row in (self.network_interface_controller or []):

            # =================================================
            # MAC ADDRESS VALIDATION
            # =================================================
            if row.mac_address:

                row.mac_address = (
                    row.mac_address
                    .strip()
                    .upper()
                )

                mac = row.mac_address

                # FORMAT CHECK
                if not mac_regex.match(mac):

                    frappe.throw(
                        _(
                            "Invalid MAC Address "
                            "in row {0}: {1}"
                        ).format(row.idx, mac)
                    )

                # DUPLICATE INSIDE SAME DOCUMENT
                if mac in mac_list:

                    frappe.throw(
                        _(
                            "Duplicate MAC Address "
                            "in current document: {0}"
                        ).format(mac)
                    )

                mac_list.append(mac)

                # GLOBAL DUPLICATE CHECK
                existing_mac = frappe.db.exists(
                    "Network Interface Controller",
                    {
                        "mac_address": mac,
                        "parent": ["!=", self.name]
                    }
                )

                if existing_mac:

                    frappe.throw(
                        _(
                            "MAC Address already exists "
                            "in another asset: {0}"
                        ).format(mac)
                    )

            # =================================================
            # IPv4 VALIDATION
            # =================================================
            if row.ip_address:

                row.ip_address = row.ip_address.strip()

                if not ipv4_regex.match(row.ip_address):

                    frappe.throw(
                        _(
                            "Invalid IPv4 Address "
                            "in row {0}: {1}"
                        ).format(
                            row.idx,
                            row.ip_address
                        )
                    )

            # =================================================
            # IPv6 VALIDATION
            # =================================================
            if row.ip_v6:

                row.ip_v6 = row.ip_v6.strip()

                try:

                    ipaddress.IPv6Address(
                        row.ip_v6
                    )

                except Exception:

                    frappe.throw(
                        _(
                            "Invalid IPv6 Address "
                            "in row {0}: {1}"
                        ).format(
                            row.idx,
                            row.ip_v6
                        )
                    )


    def before_submit(self):
        self.status = "Instock"


    def validate_device_configuration_status_remark(self):
        """
        Only on update:
        If status is changed in IT Device Configuration child table,
        remarks is mandatory only for that changed row.
        """

        # Skip new document insert
        if self.is_new():
            return

        old_doc = self.get_doc_before_save()

        if old_doc:
            old_rows = {
                row.name: row
                for row in (old_doc.device_configuration or [])
            }
        else:
            old_rows = {
                row.name: row
                for row in frappe.get_all(
                    "IT Device Configuration",
                    filters={
                        "parent": self.name,
                        "parenttype": self.doctype,
                        "parentfield": "device_configuration"
                    },
                    fields=["name", "status"]
                )
            }

        for row in (self.device_configuration or []):
            old_row = old_rows.get(row.name)

            # Skip newly added child rows
            if not old_row:
                continue

            old_status = frappe.utils.cstr(old_row.status)
            new_status = frappe.utils.cstr(row.status)
            remarks = frappe.utils.cstr(row.remarks).strip()

            # Child table status changed
            if old_status != new_status and not remarks:
                frappe.throw(
                    _(
                        "Remarks is mandatory in IT Device Configuration row {0} "
                        "because Status changed from '{1}' to '{2}'."
                    ).format(
                        row.idx,
                        old_status,
                        new_status
                    )
                )


    def before_cancel(self):
        self.status = "Cancelled"




@frappe.whitelist()
def get_asset_item_trace(asset_item):
    if not asset_item:
        frappe.throw(_("IT Asset Item is required"))

    doc = frappe.get_doc("IT Asset Item", asset_item)
    doc.check_permission("read")

    meta = frappe.get_meta("IT Asset Item")
    trace = get_document_trace("IT Asset Item", doc.name)
    events = trace.get("events", [])
    events.extend(_get_linked_asset_document_events(doc.name))
    events = _sort_trace_events(events)

    return {
        "asset_item": doc.name,
        "current_status": doc.status,
        "track_changes": bool(meta.track_changes),
        "events": events
    }


def get_document_trace(doctype, docname, source_doctype=None, source_name=None):
    doc = frappe.get_doc(doctype, docname)
    doc.check_permission("read")

    meta = frappe.get_meta(doctype)
    versions = frappe.get_all(
        "Version",
        filters={
            "ref_doctype": doctype,
            "docname": doc.name
        },
        fields=[
            "name",
            "owner",
            "creation",
            "modified_by",
            "data"
        ],
        order_by="creation asc"
    )

    events = [
        _get_creation_trace_event(
            doc,
            meta,
            source_doctype=source_doctype,
            source_name=source_name
        )
    ]

    for version in versions:
        data = frappe.parse_json(version.data or "{}")
        event = _get_version_trace_event(
            version,
            data,
            meta,
            source_doctype=source_doctype,
            source_name=source_name
        )

        if event:
            events.append(event)

    return {
        "doctype": doctype,
        "docname": doc.name,
        "current_status": doc.get("status"),
        "track_changes": bool(meta.track_changes),
        "events": _sort_trace_events(events)
    }


def _get_linked_asset_document_events(asset_item):
    events = []

    for doctype, docname in _get_linked_asset_documents(asset_item):
        trace = get_document_trace(
            doctype,
            docname,
            source_doctype=doctype,
            source_name=docname
        )
        events.extend(trace.get("events", []))

    return events


def _get_linked_asset_documents(asset_item):
    documents = []

    documents.extend(_get_direct_asset_documents(
        "IT Software Configuration",
        asset_item
    ))
    documents.extend(_get_direct_asset_documents(
        "IT Asset Repair",
        asset_item
    ))
    documents.extend(_get_child_asset_documents(
        "IT Asset Allocation",
        "assigned_device",
        asset_item
    ))
    documents.extend(_get_child_asset_documents(
        "IT Asset Decommissioning",
        "it_asset_decommissioning",
        asset_item
    ))

    return documents


def _get_direct_asset_documents(doctype, asset_item):
    rows = frappe.get_all(
        doctype,
        filters={
            "it_asset_item": asset_item
        },
        fields=["name"],
        order_by="creation asc"
    )

    return [(doctype, row.name) for row in rows]


def _get_child_asset_documents(parent_doctype, parentfield, asset_item):
    rows = frappe.get_all(
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

    for row in rows:
        if not row.parent or row.parent in seen:
            continue

        seen.add(row.parent)
        parent_names.append(row.parent)

    if not parent_names:
        return []

    parents = frappe.get_all(
        parent_doctype,
        filters={
            "name": ["in", parent_names]
        },
        fields=["name"],
        order_by="creation asc"
    )

    return [(parent_doctype, parent.name) for parent in parents]


def _get_child_field_changes(child_meta, old_row, row):
    changes = []

    for df in child_meta.fields:
        if not _is_traceable_field(df):
            continue

        old_value = old_row.get(df.fieldname)
        new_value = row.get(df.fieldname)

        if _trace_value(old_value) == _trace_value(new_value):
            continue

        old_log_value = _get_trace_log_value(old_value, df)
        new_log_value = _get_trace_log_value(new_value, df)

        if df.fieldtype == "Password" and old_log_value == new_log_value:
            new_log_value = "Changed"

        changes.append([
            df.fieldname,
            old_log_value,
            new_log_value
        ])

    return changes


def _is_traceable_field(df):
    if not df or not df.fieldname:
        return False

    return df.fieldtype not in [
        "Section Break",
        "Column Break",
        "Tab Break",
        "HTML",
        "Button",
        "Image",
        "Fold",
        "Table"
    ]


def _trace_value(value):
    return frappe.utils.cstr(value)


def _get_trace_log_value(value, df):
    if df and df.fieldtype == "Password":
        return "********" if value else ""

    return value


def update_asset_item_status(asset_item, status, reference_doctype=None, reference_name=None):
    if not asset_item:
        return

    old_status = frappe.db.get_value(
        "IT Asset Item",
        asset_item,
        "status"
    )

    frappe.db.set_value(
        "IT Asset Item",
        asset_item,
        "status",
        status,
        update_modified=False
    )

    if old_status != status:
        log_asset_item_trace(
            asset_item,
            changed=[["status", old_status, status]],
            reference_doctype=reference_doctype,
            reference_name=reference_name
        )


def log_asset_item_child_row_change(
    asset_item,
    table_fieldname,
    row_index,
    row_name,
    changed,
    reference_doctype=None,
    reference_name=None
):
    if not changed:
        return

    log_asset_item_trace(
        asset_item,
        row_changed=[[table_fieldname, row_index, row_name, changed]],
        reference_doctype=reference_doctype,
        reference_name=reference_name
    )


def log_asset_item_child_row_added(
    asset_item,
    table_fieldname,
    row,
    reference_doctype=None,
    reference_name=None
):
    row_data = row.as_dict() if hasattr(row, "as_dict") else row

    log_asset_item_trace(
        asset_item,
        added=[[table_fieldname, row_data]],
        reference_doctype=reference_doctype,
        reference_name=reference_name
    )


def log_asset_item_trace(
    asset_item,
    changed=None,
    added=None,
    removed=None,
    row_changed=None,
    reference_doctype=None,
    reference_name=None
):
    if not asset_item:
        return

    log_document_trace(
        "IT Asset Item",
        asset_item,
        changed=changed,
        added=added,
        removed=removed,
        row_changed=row_changed,
        reference_doctype=reference_doctype,
        reference_name=reference_name
    )


def log_document_trace(
    doctype,
    docname,
    changed=None,
    added=None,
    removed=None,
    row_changed=None,
    reference_doctype=None,
    reference_name=None
):
    if not doctype or not docname:
        return

    changed = [
        change
        for change in (changed or [])
        if len(change) < 3 or change[1] != change[2]
    ]
    added = added or []
    removed = removed or []
    row_changed = row_changed or []

    if not any([changed, added, removed, row_changed]):
        return

    data = {
        "changed": changed,
        "added": added,
        "removed": removed,
        "row_changed": row_changed
    }

    if reference_doctype or reference_name:
        data["updater_reference"] = {
            "doctype": reference_doctype,
            "docname": reference_name
        }

    version = frappe.get_doc({
        "doctype": "Version",
        "ref_doctype": doctype,
        "docname": docname,
        "data": frappe.as_json(
            data,
            indent=None,
            separators=(",", ":")
        )
    })
    version.insert(ignore_permissions=True)


def _get_creation_trace_event(doc, meta, source_doctype=None, source_name=None):
    return {
        "title": _("Document Created"),
        "timestamp": doc.creation,
        "timestamp_display": _format_datetime(doc.creation),
        "user": doc.owner,
        "source_doctype": source_doctype,
        "source_name": source_name,
        "version": None,
        "changes": [
            {
                "type": "field",
                "fieldname": "name",
                "label": _get_field_label(meta, "name"),
                "from": "",
                "to": doc.name
            },
            {
                "type": "field",
                "fieldname": "status",
                "label": _get_field_label(meta, "status"),
                "from": "",
                "to": doc.get("status") or _("Draft")
            }
        ]
    }


def _get_version_trace_event(version, data, meta, source_doctype=None, source_name=None):
    if not data:
        return None

    changes = []

    for fieldname, old_value, new_value in data.get("changed", []):
        df = meta.get_field(fieldname)
        changes.append({
            "type": "field",
            "fieldname": fieldname,
            "label": _get_field_label(meta, fieldname),
            "from": _format_value(old_value, df),
            "to": _format_value(new_value, df)
        })

    for table_fieldname, row_data in data.get("added", []):
        table_df = meta.get_field(table_fieldname)
        changes.append({
            "type": "row_added",
            "table_fieldname": table_fieldname,
            "table_label": _get_field_label(meta, table_fieldname),
            "row": _get_row_label(
                frappe.utils.cint(row_data.get("idx")) - 1
                if isinstance(row_data, dict) and row_data.get("idx")
                else None,
                row_data.get("name") if isinstance(row_data, dict) else None
            ),
            "details": _get_row_details(row_data, table_df)
        })

    for table_fieldname, row_data in data.get("removed", []):
        table_df = meta.get_field(table_fieldname)
        changes.append({
            "type": "row_removed",
            "table_fieldname": table_fieldname,
            "table_label": _get_field_label(meta, table_fieldname),
            "row": _get_row_label(
                frappe.utils.cint(row_data.get("idx")) - 1
                if isinstance(row_data, dict) and row_data.get("idx")
                else None,
                row_data.get("name") if isinstance(row_data, dict) else None
            ),
            "details": _get_row_details(row_data, table_df)
        })

    for row_change in data.get("row_changed", []):
        if len(row_change) < 4:
            continue

        table_fieldname = row_change[0]
        row_index = row_change[1]
        row_name = row_change[2]
        field_changes = row_change[3]
        table_df = meta.get_field(table_fieldname)
        child_meta = frappe.get_meta(table_df.options) if table_df and table_df.options else None

        for fieldname, old_value, new_value in field_changes:
            df = child_meta.get_field(fieldname) if child_meta else None
            changes.append({
                "type": "child_field",
                "table_fieldname": table_fieldname,
                "table_label": _get_field_label(meta, table_fieldname),
                "row": _get_row_label(row_index, row_name),
                "fieldname": fieldname,
                "label": _get_field_label(child_meta, fieldname) if child_meta else fieldname,
                "from": _format_value(old_value, df),
                "to": _format_value(new_value, df)
            })

    if not changes:
        return None

    source = _get_source(data, source_doctype, source_name)

    return {
        "title": _get_event_title(changes),
        "timestamp": version.creation,
        "timestamp_display": _format_datetime(version.creation),
        "user": version.modified_by or version.owner,
        "source_doctype": source.get("doctype"),
        "source_name": source.get("docname"),
        "version": version.name,
        "changes": changes
    }


def _get_event_title(changes):
    if any(change.get("fieldname") == "status" for change in changes):
        return _("Status Changed")

    if any(change.get("type") == "child_field" for change in changes):
        return _("Child Table Updated")

    if any(change.get("type") == "row_added" for change in changes):
        return _("Child Row Added")

    if any(change.get("type") == "row_removed" for change in changes):
        return _("Child Row Removed")

    return _("Document Updated")


def _get_source(data, source_doctype=None, source_name=None):
    if source_doctype or source_name:
        return {
            "doctype": source_doctype,
            "docname": source_name
        }

    source = data.get("updater_reference")

    if isinstance(source, dict):
        return {
            "doctype": source.get("doctype"),
            "docname": source.get("docname") or source.get("name")
        }

    if source:
        return {
            "doctype": None,
            "docname": frappe.utils.cstr(source)
        }

    return {
        "doctype": None,
        "docname": None
    }


def _sort_trace_events(events):
    return sorted(
        events,
        key=lambda event: frappe.utils.cstr(event.get("timestamp"))
    )


def _get_field_label(meta, fieldname):
    if not meta:
        return fieldname

    labels = {
        "name": _("Document Name"),
        "docstatus": _("Document Status")
    }

    if fieldname in labels:
        return labels[fieldname]

    label = meta.get_label(fieldname)

    if label and label != "No Label":
        return label

    return fieldname


def _get_row_label(row_index, row_name):
    if row_index not in [None, ""]:
        row_number = frappe.utils.cint(row_index)

        if row_number or frappe.utils.cstr(row_index) == "0":
            return _("Row {0}").format(row_number + 1)

    if row_name:
        return frappe.utils.cstr(row_name)

    return _("Row")


def _get_row_details(row_data, table_df):
    if not isinstance(row_data, dict):
        return []

    child_doctype = row_data.get("doctype")

    if not child_doctype and table_df:
        child_doctype = table_df.options

    if not child_doctype:
        return []

    child_meta = frappe.get_meta(child_doctype)
    fields = [df for df in child_meta.fields if df.in_list_view]

    if not fields:
        fields = [
            df
            for df in child_meta.fields
            if df.fieldtype not in ["Section Break", "Column Break"]
        ]

    details = []

    for df in fields:
        value = row_data.get(df.fieldname)

        if value in [None, ""]:
            continue

        details.append({
            "label": _get_field_label(child_meta, df.fieldname),
            "value": _format_value(value, df)
        })

        if len(details) == 8:
            break

    return details


def _format_value(value, df=None):
    if value in [None, ""]:
        return ""

    if df and df.fieldtype == "Password":
        return "********"

    return frappe.utils.cstr(value)


def _format_datetime(value):
    if not value:
        return ""

    return frappe.utils.format_datetime(value)
