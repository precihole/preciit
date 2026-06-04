// Copyright (c) 2026, Shubham Mishra and contributors
// For license information, please see license.txt

// frappe.ui.form.on("IT Software Configuration", {
// 	refresh(frm) {

// 	},
// });


frappe.ui.form.on("IT Software Configuration", {

    on_submit(frm) {

        if (!frm.doc.it_asset_item) return;

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
            frm.doc.it_asset_item
        );

        // ==============================
        // FORCE REFRESH AFTER OPEN
        // ==============================
        setTimeout(() => {

            cur_frm.reload_doc();

        }, 1500);
    }
});
// This is for OS details child table, Software details child table to show/hide license fields based on activation status

frappe.ui.form.on("IT Software Configuration", {
    refresh(frm) {

        frm.remove_custom_button("Software Trace");

        if (!frm.is_new()) {
            frm.add_custom_button("Software Trace", function() {
                show_software_trace_dialog(frm);
            });
        }

        toggle_configuration_tables(frm);

        toggle_license_fields(
            frm,
            "os_details"
        );

        toggle_license_fields(
            frm,
            "software_details"
        );
    },

    os_configuration_not_required(frm) {
        toggle_configuration_tables(frm);
    },

    software_configuration_not_required(frm) {
        toggle_configuration_tables(frm);
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

function toggle_configuration_tables(frm) {

    frm.toggle_display(
        "os_details",
        !frm.doc.os_configuration_not_required
    );

    frm.toggle_display(
        "software_details",
        !frm.doc.software_configuration_not_required
    );
}


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


// ==============================
// SOFTWARE CONFIGURATION TRACE
// ==============================
function show_software_trace_dialog(frm) {

    let d = new frappe.ui.Dialog({
        title: "Software Configuration Trace",
        size: "extra-large",
        fields: [
            {
                fieldtype: "HTML",
                fieldname: "software_trace_html"
            }
        ]
    });

    d.show();

    d.fields_dict.software_trace_html.$wrapper.html(`
        <div class="software-trace-loading">
            Loading trace history...
        </div>
    `);

    frappe.call({
        method: "preciit.preciit.doctype.it_software_configuration.it_software_configuration.get_software_configuration_trace",
        args: {
            software_configuration: frm.doc.name
        },
        freeze: true,
        callback: function(r) {
            let trace = r.message || {};
            d.fields_dict.software_trace_html.$wrapper.html(
                render_software_trace(trace)
            );
            bind_software_trace_links(d);
        }
    });
}


function render_software_trace(trace) {

    let events = trace.events || [];
    let event_html = events.length
        ? events.map(render_software_trace_event).join("")
        : `
            <div class="software-trace-empty">
                No trace records found for this software configuration.
            </div>
        `;

    let track_note = trace.track_changes
        ? ""
        : `
            <div class="software-trace-warning">
                Track Changes is not enabled in the database metadata yet.
                Run migrate or reload this DocType so future field and child-table saves are recorded.
            </div>
        `;

    return `
        <style>
            .software-trace{
                color:#1f2937;
                max-height:70vh;
                overflow:auto;
                padding:4px 2px 8px;
            }

            .software-trace-loading,
            .software-trace-empty{
                padding:24px;
                text-align:center;
                color:#6b7280;
            }

            .software-trace-summary{
                display:grid;
                grid-template-columns:repeat(4, minmax(0, 1fr));
                gap:10px;
                margin-bottom:14px;
            }

            .software-trace-stat{
                border:1px solid #e5e7eb;
                border-radius:8px;
                padding:10px 12px;
                background:#ffffff;
            }

            .software-trace-label{
                color:#6b7280;
                font-size:11px;
                font-weight:600;
                text-transform:uppercase;
            }

            .software-trace-value{
                margin-top:4px;
                font-size:14px;
                font-weight:700;
                color:#111827;
                overflow-wrap:anywhere;
            }

            .software-trace-warning{
                margin-bottom:14px;
                padding:10px 12px;
                border:1px solid #f59e0b;
                border-radius:8px;
                background:#fffbeb;
                color:#92400e;
                font-size:12px;
            }

            .software-trace-timeline{
                border-left:2px solid #d1d5db;
                margin-left:12px;
                padding-left:18px;
            }

            .software-trace-event{
                position:relative;
                margin-bottom:16px;
                border:1px solid #e5e7eb;
                border-radius:8px;
                background:#ffffff;
            }

            .software-trace-event:before{
                content:"";
                position:absolute;
                width:12px;
                height:12px;
                border-radius:50%;
                background:#2563eb;
                border:2px solid #ffffff;
                left:-25px;
                top:16px;
                box-shadow:0 0 0 1px #2563eb;
            }

            .software-trace-event-head{
                display:flex;
                justify-content:space-between;
                gap:12px;
                padding:12px 14px;
                border-bottom:1px solid #f3f4f6;
                align-items:flex-start;
            }

            .software-trace-title{
                font-size:14px;
                font-weight:700;
                color:#111827;
            }

            .software-trace-meta{
                margin-top:4px;
                display:flex;
                flex-wrap:wrap;
                gap:8px;
                color:#6b7280;
                font-size:12px;
            }

            .software-trace-time{
                color:#374151;
                font-size:12px;
                white-space:nowrap;
            }

            .software-trace-link{
                border:0;
                background:transparent;
                color:#2563eb;
                padding:0;
                font-size:12px;
                cursor:pointer;
            }

            .software-trace-table{
                width:100%;
                border-collapse:collapse;
                table-layout:fixed;
                font-size:12px;
            }

            .software-trace-table th{
                text-align:left;
                padding:9px 10px;
                border-bottom:1px solid #f3f4f6;
                color:#6b7280;
                font-weight:700;
                background:#f9fafb;
            }

            .software-trace-table td{
                vertical-align:top;
                padding:9px 10px;
                border-bottom:1px solid #f9fafb;
                overflow-wrap:anywhere;
            }

            .software-trace-table tr:last-child td{
                border-bottom:0;
            }

            .software-trace-badge{
                display:inline-flex;
                align-items:center;
                min-height:22px;
                border-radius:999px;
                padding:2px 8px;
                font-size:11px;
                font-weight:700;
                background:#eef2ff;
                color:#3730a3;
            }

            .software-trace-muted{
                color:#9ca3af;
                font-style:italic;
            }

            .software-trace-details{
                display:flex;
                flex-wrap:wrap;
                gap:6px;
            }

            .software-trace-detail{
                border:1px solid #e5e7eb;
                border-radius:6px;
                padding:4px 6px;
                background:#f9fafb;
            }

            @media (max-width: 768px){
                .software-trace-summary{
                    grid-template-columns:1fr;
                }

                .software-trace-event-head{
                    display:block;
                }

                .software-trace-time{
                    margin-top:8px;
                }

                .software-trace-table{
                    min-width:760px;
                }
            }
        </style>

        <div class="software-trace">
            <div class="software-trace-summary">
                <div class="software-trace-stat">
                    <div class="software-trace-label">Configuration</div>
                    <div class="software-trace-value">
                        ${software_trace_value(trace.software_configuration)}
                    </div>
                </div>
                <div class="software-trace-stat">
                    <div class="software-trace-label">IT Asset Item</div>
                    <div class="software-trace-value">
                        ${software_trace_value(trace.it_asset_item)}
                    </div>
                </div>
                <div class="software-trace-stat">
                    <div class="software-trace-label">Current Status</div>
                    <div class="software-trace-value">
                        ${software_trace_value(trace.current_status)}
                    </div>
                </div>
                <div class="software-trace-stat">
                    <div class="software-trace-label">Trace Records</div>
                    <div class="software-trace-value">
                        ${events.length}
                    </div>
                </div>
            </div>

            ${track_note}

            <div class="software-trace-timeline">
                ${event_html}
            </div>
        </div>
    `;
}


function render_software_trace_event(event) {

    let source = render_software_trace_source(event);
    let rows = (event.changes || [])
        .map(render_software_trace_change)
        .join("");

    return `
        <div class="software-trace-event">
            <div class="software-trace-event-head">
                <div>
                    <div class="software-trace-title">
                        ${software_trace_value(event.title)}
                    </div>
                    <div class="software-trace-meta">
                        <span>By ${software_trace_value(event.user)}</span>
                        ${source}
                    </div>
                </div>
                <div class="software-trace-time">
                    ${software_trace_value(event.timestamp_display)}
                </div>
            </div>

            <div style="overflow:auto;">
                <table class="software-trace-table">
                    <thead>
                        <tr>
                            <th style="width:120px;">Change</th>
                            <th style="width:150px;">Table</th>
                            <th style="width:140px;">Row</th>
                            <th style="width:170px;">Field</th>
                            <th>From</th>
                            <th>To / Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


function render_software_trace_change(change) {

    if (change.type === "field") {
        return `
            <tr>
                <td><span class="software-trace-badge">Field</span></td>
                <td>-</td>
                <td>-</td>
                <td>${software_trace_value(change.label)}</td>
                <td>${software_trace_value(change.from)}</td>
                <td>${software_trace_value(change.to)}</td>
            </tr>
        `;
    }

    if (change.type === "child_field") {
        return `
            <tr>
                <td><span class="software-trace-badge">Child Field</span></td>
                <td>${software_trace_value(change.table_label)}</td>
                <td>${software_trace_value(change.row)}</td>
                <td>${software_trace_value(change.label)}</td>
                <td>${software_trace_value(change.from)}</td>
                <td>${software_trace_value(change.to)}</td>
            </tr>
        `;
    }

    if (change.type === "row_added" || change.type === "row_removed") {
        let label = change.type === "row_added" ? "Row Added" : "Row Removed";

        return `
            <tr>
                <td><span class="software-trace-badge">${label}</span></td>
                <td>${software_trace_value(change.table_label)}</td>
                <td>${software_trace_value(change.row)}</td>
                <td>-</td>
                <td>-</td>
                <td>${render_software_trace_details(change.details)}</td>
            </tr>
        `;
    }

    return "";
}


function render_software_trace_source(event) {

    if (!event.source_doctype && !event.source_name) {
        return "";
    }

    if (event.source_doctype && event.source_name) {
        return `
            <button
                class="software-trace-link"
                data-trace-doctype="${software_trace_escape(event.source_doctype)}"
                data-trace-name="${software_trace_escape(event.source_name)}">
                Source: ${software_trace_value(event.source_doctype)} ${software_trace_value(event.source_name)}
            </button>
        `;
    }

    return `
        <span>
            Source: ${software_trace_value(event.source_name)}
        </span>
    `;
}


function render_software_trace_details(details) {

    if (!details || !details.length) {
        return `<span class="software-trace-muted">No row details</span>`;
    }

    return `
        <div class="software-trace-details">
            ${details.map(detail => `
                <span class="software-trace-detail">
                    <b>${software_trace_value(detail.label)}:</b>
                    ${software_trace_value(detail.value)}
                </span>
            `).join("")}
        </div>
    `;
}


function bind_software_trace_links(dialog) {

    dialog.$wrapper.find("[data-trace-doctype]").on("click", function() {
        frappe.set_route(
            "Form",
            $(this).attr("data-trace-doctype"),
            $(this).attr("data-trace-name")
        );
    });
}


function software_trace_value(value) {

    if (value === null || value === undefined || value === "") {
        return `<span class="software-trace-muted">Blank</span>`;
    }

    return software_trace_escape(value).replace(/\n/g, "<br>");
}


function software_trace_escape(value) {

    if (value === null || value === undefined) {
        return "";
    }

    if (frappe.utils && frappe.utils.escape_html) {
        return frappe.utils.escape_html(String(value));
    }

    return $("<div>").text(String(value)).html();
}
