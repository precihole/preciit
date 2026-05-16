// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Asset Deallocation", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Asset Deallocation", {

    refresh(frm) {

        // ======================
        // CUSTOM STATUS
        // ======================
        setTimeout(() => {

            frm.page.clear_indicator();

            if (frm.doc.docstatus === 1) {

                frm.page.set_indicator(
                    "Deallocated",
                    "orange"
                );

            } else if (frm.doc.docstatus === 0) {

                frm.page.set_indicator(
                    "Draft",
                    "gray"
                );

            } else if (frm.doc.docstatus === 2) {

                frm.page.set_indicator(
                    "Cancelled",
                    "red"
                );
            }

        }, 100);
    },

    // ======================
    // ON SUBMIT
    // ======================
    on_submit(frm) {

        if (!frm.doc.device_deallocation?.length) return;

        let asset = frm.doc.device_deallocation[0].asset;

        frappe.show_alert({
            message: "Asset Deallocated Successfully",
            indicator: "green"
        });

        // ======================
        // OPEN ASSET ITEM
        // ======================
        frappe.set_route(
            "Form",
            "Asset Item",
            asset
        );

        // ======================
        // FORCE REFRESH
        // ======================
        setTimeout(() => {

            cur_frm.reload_doc();

        }, 1500);
    }
});