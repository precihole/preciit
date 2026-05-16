# # Copyright (c) 2026, Precihole Group and contributors
# # For license information, please see license.txt

# class AssetItem(Document):
# 	pass


# Copyright (c) 2026, Precihole Group and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
import re
from frappe import _


class AssetItem(Document):

    def autoname(self):

        device_type = (self.device_type or "GEN").upper().replace(" ", "-")
        year = frappe.utils.now_datetime().year

        self.name = make_autoname(f"IT-{device_type}-{year}-.#####")

    def validate(self):

        # ======================
        # SERIAL NUMBER UNIQUE
        # ======================
        if self.serial_no:

            existing_asset = frappe.db.exists(
                "Asset Item",
                {
                    "serial_no": self.serial_no,
                    "name": ["!=", self.name]
                }
            )

            if existing_asset:

                frappe.throw(
                    _("Serial Number already exists in Asset Item: {0}")
                    .format(existing_asset)
                )

        # ======================
        # REGEX
        # ======================
        mac_regex = re.compile(
            r"^([0-9A-F]{2}:){5}[0-9A-F]{2}$",
            re.I
        )

        ipv4_regex = re.compile(
            r"^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)"
            r"(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$"
        )

        ipv6_regex = re.compile(
            r"^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$"
        )

        mac_list = []

        # ======================
        # CHILD TABLE VALIDATION
        # ======================
        for row in (self.network_interface_controller or []):

            # ======================
            # MAC VALIDATION
            # ======================
            if row.mac_address:

                mac = row.mac_address.upper()

                if not mac_regex.match(mac):

                    frappe.throw(
                        _("Invalid MAC Address in row {0}: {1}")
                        .format(row.idx, mac)
                    )

                if mac in mac_list:

                    frappe.throw(
                        _("Duplicate MAC Address: {0}")
                        .format(mac)
                    )

                mac_list.append(mac)

            # ======================
            # IPv4 VALIDATION
            # ======================
            if row.ip_address:

                if not ipv4_regex.match(row.ip_address):

                    frappe.throw(
                        _("Invalid IPv4 in row {0}: {1}")
                        .format(row.idx, row.ip_address)
                    )

            # ======================
            # IPv6 VALIDATION
            # ======================
            if row.ip_v6:

                if not ipv6_regex.match(row.ip_v6):

                    frappe.throw(
                        _("Invalid IPv6 in row {0}: {1}")
                        .format(row.idx, row.ip_v6)
                    )

    def on_submit(self):

        # ======================
        # SET DEFAULT STATUS
        # ======================
        self.db_set(
            "status",
            "Available",
            update_modified=False
        )