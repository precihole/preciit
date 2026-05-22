// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

// frappe.ui.form.on("IT Software Configuration", {
// 	refresh(frm) {

// 	},
// });


frappe.ui.form.on("IT Software Configuration", {

    on_submit(frm) {

        if (!frm.doc.asset_name) return;

        frappe.show_alert({
            message: "Asset updated successfully",
            indicator: "green"
        });

        // ==============================
        // OPEN ASSET ITEM
        // ==============================
        frappe.set_route(
            "Form",
            "IT Asset Item",
            frm.doc.asset_name
        );

        // ==============================
        // FORCE REFRESH AFTER OPEN
        // ==============================
        setTimeout(() => {

            cur_frm.reload_doc();

        }, 1500);
    }
});
// This is for OS details child table, to show/hide license fields based on activation status

frappe.ui.form.on("IT Software Configuration", {
    refresh(frm) {

        toggle_license_fields(
            frm,
            "os_details"
        );

        toggle_license_fields(
            frm,
            "software_details"
        );
    }
});


// ==============================
// OS DETAILS CHILD TABLE
// ==============================
frappe.ui.form.on("IT Operating System Details", {

    license_activation_status(frm, cdt, cdn) {

        toggle_child_license_fields(
            frm,
            cdt,
            cdn,
            "os_details"
        );
    },

    license_expiration_date(frm, cdt, cdn) {

        handle_expiration_date(
            frm,
            cdt,
            cdn,
            "os_details"
        );
    },

    never_expire(frm, cdt, cdn) {

        handle_never_expire(
            frm,
            cdt,
            cdn,
            "os_details"
        );
    },

    form_render(frm, cdt, cdn) {

        toggle_mutual_fields(
            frm,
            cdt,
            cdn,
            "os_details"
        );
    }
});


// ==============================
// SOFTWARE DETAILS CHILD TABLE
// ==============================
frappe.ui.form.on("IT Software Configuration Item Details", {

    license_activation_status(frm, cdt, cdn) {

        toggle_child_license_fields(
            frm,
            cdt,
            cdn,
            "software_details"
        );
    },

    license_expiration_date(frm, cdt, cdn) {

        handle_expiration_date(
            frm,
            cdt,
            cdn,
            "software_details"
        );
    },

    never_expire(frm, cdt, cdn) {

        handle_never_expire(
            frm,
            cdt,
            cdn,
            "software_details"
        );
    },

    form_render(frm, cdt, cdn) {

        toggle_mutual_fields(
            frm,
            cdt,
            cdn,
            "software_details"
        );
    }
});


// ==============================
// COMMON FUNCTIONS
// ==============================

// Toggle all rows
function toggle_license_fields(frm, table_field) {

    (frm.doc[table_field] || []).forEach(row => {

        toggle_child_license_fields(
            frm,
            row.doctype,
            row.name,
            table_field
        );
    });
}


// Hide license fields for UnLicensed
function toggle_child_license_fields(frm, cdt, cdn, table_field) {

    let row = locals[cdt][cdn];

    let hide_fields =
        row.license_activation_status === "UnLicensed";

    let fields = [
        "never_expire",
        "license_type",
        "license_key",
        "license_activation_date",
        "license_expiration_date"
    ];

    fields.forEach(field => {

        frm.fields_dict[table_field]
            .grid
            .update_docfield_property(
                field,
                "hidden",
                hide_fields
            );
    });

    frm.refresh_field(table_field);
}


// Expiration date logic
function handle_expiration_date(
    frm,
    cdt,
    cdn,
    table_field
) {

    let row = locals[cdt][cdn];

    if (row.license_expiration_date) {

        frappe.model.set_value(
            cdt,
            cdn,
            "never_expire",
            0
        );
    }

    toggle_mutual_fields(
        frm,
        cdt,
        cdn,
        table_field
    );
}


// Never expire logic
function handle_never_expire(
    frm,
    cdt,
    cdn,
    table_field
) {

    let row = locals[cdt][cdn];

    if (row.never_expire) {

        frappe.model.set_value(
            cdt,
            cdn,
            "license_expiration_date",
            null
        );
    }

    toggle_mutual_fields(
        frm,
        cdt,
        cdn,
        table_field
    );
}


// Toggle mutually exclusive fields
function toggle_mutual_fields(
    frm,
    cdt,
    cdn,
    table_field
) {

    let row = locals[cdt][cdn];

    let grid_row =
        frm.fields_dict[table_field]
            .grid
            .grid_rows_by_docname[row.name];

    if (!grid_row) return;

    // Hide never expire if date exists
    grid_row.toggle_display(
        "never_expire",
        !row.license_expiration_date
    );

    // Hide expiration date if checkbox checked
    grid_row.toggle_display(
        "license_expiration_date",
        !row.never_expire
    );
}

