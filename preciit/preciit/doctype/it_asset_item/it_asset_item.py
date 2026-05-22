# # Copyright (c) 2026, Precihole Group and contributors
# # For license information, please see license.txt

# class ITAssetItem(Document):
# 	pass


# Copyright (c) 2026, Precihole Group and contributors
# For license information, please see license.txt

import ipaddress
from unicodedata import name

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname
import re
from frappe import _




class ITAssetItem(Document):

    # =========================================================
    # AUTONAME
    # =========================================================
    def autoname(self):

        device_type = (
            (self.device_type or "GEN")
            .strip()
            .upper()
            .replace(" ", "-")
        )

        year = frappe.utils.now_datetime().year

        self.name = make_autoname(
            f"IT-{device_type}-{year}-.#####"
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
    # VALIDATE
    # =========================================================
    def validate(self):

        self.validate_serial_number()
        self.validate_network_interfaces()

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

    # =========================================================
    # ON SUBMIT
    # =========================================================
    # def on_submit(self):

    #     if not self.status:

    #         self.db_set(
    #             "status",
    #             "Instock",
    #             update_modified=False
    #         )
    # =========================================================
    # BEFORE SUBMIT
    # =========================================================
    def before_submit(self):

        self.status = "Intock"