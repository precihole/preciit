// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("Asset Allocation", {

    refresh(frm) {

        // ==============================
        // ASSET DEALLOCATION
        // ==============================
        if (frm.doc.docstatus === 1 && frm.doc.status === "Allocated") {

            frm.add_custom_button(
                "Asset Deallocation",
                () => {

                    let assets = (frm.doc.assigned_device || [])
                        .map(r => r.asset)
                        .join(", ");

                    frappe.confirm(

                        `Are you sure you want to deallocate:<br><br><b>${assets}</b>?`,

                        () => {

                            frappe.call({
                                method: "preciit.preciit.doctype.asset_allocation.asset_allocation.deallocate_assets",
                                args: {
                                    docname: frm.doc.name
                                },
                                callback: function(r) {

                                    if (!r.exc) {
                                        frappe.msgprint("Assets Deallocated Successfully");
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
    }
});

frappe.ui.form.on("Asset Allocation", {

    on_submit(frm) {

        if (!frm.doc.assigned_device?.length) return;

        let asset = frm.doc.assigned_device[0].asset;

        if (!asset) return;

        frappe.show_alert({
            message: "Asset Allocated Successfully",
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

