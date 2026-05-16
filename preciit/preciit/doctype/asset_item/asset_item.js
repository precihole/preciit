// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Asset Item", {
// 	refresh(frm) {

// 	},
// });

// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("Asset Item", {

    refresh(frm) {

        // ==============================
        // 🔥 SHOW CUSTOM STATUS COLOR
        // ==============================
        setTimeout(() => {

            frm.page.clear_indicator();

            if (frm.doc.status) {
                frm.page.set_indicator(
                    frm.doc.status,
                    get_status_color(frm.doc.status)
                );
            }

        }, 100);

        // Stop for new doc
        if (frm.is_new()) return;

        // Remove old buttons
        frm.clear_custom_buttons();

        // ==============================
        // ✅ SOFTWARE CONFIGURATION
        // ==============================
        if (frm.doc.docstatus === 1 && frm.doc.status == "Available") {

            frm.add_custom_button("Software Configuration", () => {

                frappe.new_doc("Software Configuration", {
                    asset_name: frm.doc.name
                });

            }, "Actions");
        }

        // ==============================
        // ✅ ASSIGN TO EMPLOYEE
        // ==============================
        if (frm.doc.docstatus === 1 && frm.doc.status == "Software Configured") {

            frm.add_custom_button("Assign to Employee", () => {

                frappe.new_doc("Asset Allocation", {

                    assigned_device: [
                        {
                            asset: frm.doc.name
                        }
                    ]

                });

            }, "Actions");
        }

        // ==============================
        // ✅ DECOMMISSION
        // ==============================
        if (frm.doc.docstatus === 1 && frm.doc.status != "Assigned") {

            frm.add_custom_button("Asset Decommissioning", () => {

                frappe.new_doc("Asset Decommissioning", {}, (doc) => {

                    let row = frappe.model.add_child(
                        doc,
                        "asset_decommissioning"
                    );

                    row.asset = frm.doc.name;

                });

            }, "Actions");
        }
    },

    // ======================================
    // 🔒 VALIDATE BEFORE SAVE
    // ======================================
    validate(frm) {

        validate_child_table(frm, true);

    }
});


// ======================================
// 🎨 STATUS COLORS
// ======================================
function get_status_color(status) {

    const status_colors = {

        "Draft": "gray",

        "Available": "green",

        "Software Configured": "light-blue",

        "Assigned": "blue",

        "Transfer": "pink",

        "Maintenance": "yellow",

        "Faulty": "orange",

        "Decommission": "red"
    };

    return status_colors[status] || "blue";
}


// ======================================
// 🔒 VALIDATION FUNCTION
// ======================================
function validate_child_table(frm, throw_error = false) {

    // ======================
    // REGEX
    // ======================

    let mac_regex =
        /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

    let ipv4_regex =
        /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

    let ipv6_regex =
        /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    let mac_list = [];

    // ======================
    // LOOP CHILD TABLE
    // ======================
    (frm.doc.network_interface_controller_details || []).forEach(row => {

        // ======================
        // MAC ADDRESS
        // ======================
        if (row.mac_address) {

            let mac = row.mac_address.toUpperCase();

            if (!mac_regex.test(mac)) {

                if (throw_error) {

                    frappe.throw(
                        `❌ Invalid MAC Address in row ${row.idx}: ${mac}`
                    );
                }
            }

            if (mac_list.includes(mac)) {

                if (throw_error) {

                    frappe.throw(
                        `⚠️ Duplicate MAC Address: ${mac}`
                    );
                }
            }

            mac_list.push(mac);
        }

        // ======================
        // IPv4
        // ======================
        if (row.ip_address) {

            if (!ipv4_regex.test(row.ip_address)) {

                if (throw_error) {

                    frappe.throw(
                        `❌ Invalid IPv4 Address in row ${row.idx}: ${row.ip_address}`
                    );
                }
            }
        }

        // ======================
        // IPv6
        // ======================
        if (row.ip_v6) {

            if (!ipv6_regex.test(row.ip_v6)) {

                if (throw_error) {

                    frappe.throw(
                        `❌ Invalid IPv6 Address in row ${row.idx}: ${row.ip_v6}`
                    );
                }
            }
        }

    });

    return true;
}


// ======================================
// 🔥 CHILD TABLE EVENTS
// ======================================

frappe.ui.form.on("Network Interface Controller Details", {

    // ======================
    // MAC ADDRESS AUTO FORMAT
    // ======================
    mac_address(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.mac_address) return;

        // Remove non-hex chars
        let clean = row.mac_address
            .replace(/[^A-Fa-f0-9]/g, "")
            .toUpperCase();

        // Max 12 chars
        clean = clean.substring(0, 12);

        // Add colon automatically
        let formatted =
            clean.match(/.{1,2}/g)?.join(":") || clean;

        frappe.model.set_value(
            cdt,
            cdn,
            "mac_address",
            formatted
        );
    },

    // ======================
    // IPv4 AUTO CLEAN
    // ======================
    ip_address(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.ip_address) return;

        // Allow only numbers + dots
        let clean = row.ip_address
            .replace(/[^0-9.]/g, "");

        // Remove repeated dots
        clean = clean.replace(/\.{2,}/g, ".");

        frappe.model.set_value(
            cdt,
            cdn,
            "ip_address",
            clean
        );
    },

    // ======================
    // IPv6 AUTO FORMAT
    // ======================
    ip_v6(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (!row.ip_v6) return;

        // Allow only hex + colon
        let clean = row.ip_v6
            .replace(/[^A-Fa-f0-9:]/g, "")
            .toUpperCase();

        frappe.model.set_value(
            cdt,
            cdn,
            "ip_v6",
            clean
        );
    }
});