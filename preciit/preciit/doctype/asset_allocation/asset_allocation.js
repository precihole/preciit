// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("Asset Allocation", {

    refresh(frm) {



        // ==============================
        // ✅ ASSET DEALLOCATION
        // ==============================
        if (
            frm.doc.docstatus === 1
        ) {

            frm.add_custom_button("Asset Deallocation", () => {

                frappe.new_doc("Asset Deallocation", {}, (doc) => {

                    doc.employee = frm.doc.employee;

                    (frm.doc.assigned_device || []).forEach(r => {

                        let row = frappe.model.add_child(
                            doc,
                            "device_deallocation"
                        );

                        row.asset = r.asset;
                    });

                });

            }, "Actions");
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

// frappe.listview_settings["Asset Allocation"] = {

//     get_indicator(doc) {

//         if (doc.status === "Assigned") {
//             return ["Assigned", "blue", "status,=,Assigned"];
//         }

//         if (doc.status === "Cancelled") {
//             return ["Cancelled", "red", "status,=,Cancelled"];
//         }

//         return ["Draft", "gray", "status,=,UNDEFINED"];
//     }
// };