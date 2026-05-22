// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("IT Asset Allocation", {

    refresh(frm) {

        // ==============================
        // DEALLOCATE ASSET
        // ==============================
        if (
            frm.doc.docstatus === 1 &&
            frm.doc.status === "Allocated"
        ) {

            frm.add_custom_button(
                "Deallocate Asset",
                () => {

                    let assets = (frm.doc.assigned_device || [])
                        .map(r => r.it_asset_item)
                        .join(", ");

                    frappe.confirm(

                        `Are you sure you want to deallocate:<br><br><b>${assets}</b>?`,

                        () => {

                            frappe.call({

                                method: "preciit.preciit.doctype.it_asset_allocation.it_asset_allocation.deallocate_assets",

                                args: {
                                    docname: frm.doc.name
                                },

                                callback: function(r) {

                                    if (!r.exc) {

                                        frappe.show_alert({
                                            message: "Assets Deallocated Successfully",
                                            indicator: "green"
                                        });

                                        frm.reload_doc();
                                    }
                                }
                            });

                        }
                    );
                },
                "Actions"
            );
        }
    },

    // ==============================
    // ON SUBMIT
    // ==============================
    on_submit(frm) {

        if (!frm.doc.assigned_device?.length) return;

        let asset = frm.doc.assigned_device[0].it_asset_item;

        if (!asset) return;

        frappe.show_alert({
            message: "Asset Allocated Successfully",
            indicator: "green"
        });

        // OPEN ASSET
        frappe.set_route(
            "Form",
            "IT Asset Item",
            asset
        );
    }
});