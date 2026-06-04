// Copyright (c) 2026, Shubham Mishra and contributors
// For license information, please see license.txt

frappe.provide("preciit.document_trace");

preciit.document_trace.configs = {
    "IT Asset Allocation": {
        button_label: "Allocation Trace",
        dialog_title: "IT Asset Allocation Trace",
        method: "preciit.preciit.doctype.it_asset_allocation.it_asset_allocation.get_asset_allocation_trace",
        argname: "asset_allocation",
        empty_message: "No trace records found for this asset allocation."
    },
    "IT Asset Repair": {
        button_label: "Repair Trace",
        dialog_title: "IT Asset Repair Trace",
        method: "preciit.preciit.doctype.it_asset_repair.it_asset_repair.get_asset_repair_trace",
        argname: "asset_repair",
        empty_message: "No trace records found for this asset repair."
    },
    "IT Asset Decommissioning": {
        button_label: "Decommissioning Trace",
        dialog_title: "IT Asset Decommissioning Trace",
        method: "preciit.preciit.doctype.it_asset_decommissioning.it_asset_decommissioning.get_asset_decommissioning_trace",
        argname: "asset_decommissioning",
        empty_message: "No trace records found for this asset decommissioning."
    }
};

preciit.document_trace.show = function(frm, config) {
    let dialog = new frappe.ui.Dialog({
        title: config.dialog_title,
        size: "extra-large",
        fields: [
            {
                fieldtype: "HTML",
                fieldname: "document_trace_html"
            }
        ]
    });

    dialog.show();

    dialog.fields_dict.document_trace_html.$wrapper.html(`
        <div class="document-trace-loading">
            Loading trace history...
        </div>
    `);

    let args = {};
    args[config.argname] = frm.doc.name;

    frappe.call({
        method: config.method,
        args: args,
        freeze: true,
        callback: function(r) {
            let trace = r.message || {};
            dialog.fields_dict.document_trace_html.$wrapper.html(
                preciit.document_trace.render(trace, config)
            );
            preciit.document_trace.bind_links(dialog);
        }
    });
};

preciit.document_trace.render = function(trace, config) {
    let events = trace.events || [];
    let event_html = events.length
        ? events.map(preciit.document_trace.render_event).join("")
        : `
            <div class="document-trace-empty">
                ${preciit.document_trace.value(config.empty_message)}
            </div>
        `;

    let summary = trace.summary || [];
    let summary_html = summary.map(function(item) {
        return `
            <div class="document-trace-stat">
                <div class="document-trace-label">
                    ${preciit.document_trace.value(item.label)}
                </div>
                <div class="document-trace-value">
                    ${preciit.document_trace.value(item.value)}
                </div>
            </div>
        `;
    }).join("");

    summary_html += `
        <div class="document-trace-stat">
            <div class="document-trace-label">Trace Records</div>
            <div class="document-trace-value">${events.length}</div>
        </div>
    `;

    let track_note = trace.track_changes
        ? ""
        : `
            <div class="document-trace-warning">
                Track Changes is not enabled in the database metadata yet.
                Run migrate or reload this DocType so future field and child-table saves are recorded.
            </div>
        `;

    return `
        <style>
            .document-trace{
                color:#1f2937;
                max-height:70vh;
                overflow:auto;
                padding:4px 2px 8px;
            }

            .document-trace-loading,
            .document-trace-empty{
                padding:24px;
                text-align:center;
                color:#6b7280;
            }

            .document-trace-summary{
                display:grid;
                grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));
                gap:10px;
                margin-bottom:14px;
            }

            .document-trace-stat{
                border:1px solid #e5e7eb;
                border-radius:8px;
                padding:10px 12px;
                background:#ffffff;
            }

            .document-trace-label{
                color:#6b7280;
                font-size:11px;
                font-weight:600;
                text-transform:uppercase;
            }

            .document-trace-value{
                margin-top:4px;
                font-size:14px;
                font-weight:700;
                color:#111827;
                overflow-wrap:anywhere;
            }

            .document-trace-warning{
                margin-bottom:14px;
                padding:10px 12px;
                border:1px solid #f59e0b;
                border-radius:8px;
                background:#fffbeb;
                color:#92400e;
                font-size:12px;
            }

            .document-trace-timeline{
                border-left:2px solid #d1d5db;
                margin-left:12px;
                padding-left:18px;
            }

            .document-trace-event{
                position:relative;
                margin-bottom:16px;
                border:1px solid #e5e7eb;
                border-radius:8px;
                background:#ffffff;
            }

            .document-trace-event:before{
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

            .document-trace-event-head{
                display:flex;
                justify-content:space-between;
                gap:12px;
                padding:12px 14px;
                border-bottom:1px solid #f3f4f6;
                align-items:flex-start;
            }

            .document-trace-title{
                font-size:14px;
                font-weight:700;
                color:#111827;
            }

            .document-trace-meta{
                margin-top:4px;
                display:flex;
                flex-wrap:wrap;
                gap:8px;
                color:#6b7280;
                font-size:12px;
            }

            .document-trace-time{
                color:#374151;
                font-size:12px;
                white-space:nowrap;
            }

            .document-trace-link{
                border:0;
                background:transparent;
                color:#2563eb;
                padding:0;
                font-size:12px;
                cursor:pointer;
            }

            .document-trace-table{
                width:100%;
                border-collapse:collapse;
                table-layout:fixed;
                font-size:12px;
            }

            .document-trace-table th{
                text-align:left;
                padding:9px 10px;
                border-bottom:1px solid #f3f4f6;
                color:#6b7280;
                font-weight:700;
                background:#f9fafb;
            }

            .document-trace-table td{
                vertical-align:top;
                padding:9px 10px;
                border-bottom:1px solid #f9fafb;
                overflow-wrap:anywhere;
            }

            .document-trace-table tr:last-child td{
                border-bottom:0;
            }

            .document-trace-badge{
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

            .document-trace-muted{
                color:#9ca3af;
                font-style:italic;
            }

            .document-trace-details{
                display:flex;
                flex-wrap:wrap;
                gap:6px;
            }

            .document-trace-detail{
                border:1px solid #e5e7eb;
                border-radius:6px;
                padding:4px 6px;
                background:#f9fafb;
            }

            @media (max-width: 768px){
                .document-trace-summary{
                    grid-template-columns:1fr;
                }

                .document-trace-event-head{
                    display:block;
                }

                .document-trace-time{
                    margin-top:8px;
                }

                .document-trace-table{
                    min-width:760px;
                }
            }
        </style>

        <div class="document-trace">
            <div class="document-trace-summary">
                ${summary_html}
            </div>

            ${track_note}

            <div class="document-trace-timeline">
                ${event_html}
            </div>
        </div>
    `;
};

preciit.document_trace.render_event = function(event) {
    let source = preciit.document_trace.render_source(event);
    let rows = (event.changes || [])
        .map(preciit.document_trace.render_change)
        .join("");

    if (!rows) {
        rows = `
            <tr>
                <td colspan="6">
                    <span class="document-trace-muted">No detailed changes found</span>
                </td>
            </tr>
        `;
    }

    return `
        <div class="document-trace-event">
            <div class="document-trace-event-head">
                <div>
                    <div class="document-trace-title">
                        ${preciit.document_trace.value(event.title)}
                    </div>
                    <div class="document-trace-meta">
                        <span>By ${preciit.document_trace.value(event.user)}</span>
                        ${source}
                    </div>
                </div>
                <div class="document-trace-time">
                    ${preciit.document_trace.value(event.timestamp_display)}
                </div>
            </div>

            <div style="overflow:auto;">
                <table class="document-trace-table">
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
};

preciit.document_trace.render_change = function(change) {
    if (change.type === "field") {
        return `
            <tr>
                <td><span class="document-trace-badge">Field</span></td>
                <td>-</td>
                <td>-</td>
                <td>${preciit.document_trace.value(change.label)}</td>
                <td>${preciit.document_trace.value(change.from)}</td>
                <td>${preciit.document_trace.value(change.to)}</td>
            </tr>
        `;
    }

    if (change.type === "child_field") {
        return `
            <tr>
                <td><span class="document-trace-badge">Child Field</span></td>
                <td>${preciit.document_trace.value(change.table_label)}</td>
                <td>${preciit.document_trace.value(change.row)}</td>
                <td>${preciit.document_trace.value(change.label)}</td>
                <td>${preciit.document_trace.value(change.from)}</td>
                <td>${preciit.document_trace.value(change.to)}</td>
            </tr>
        `;
    }

    if (change.type === "row_added" || change.type === "row_removed") {
        let label = change.type === "row_added" ? "Row Added" : "Row Removed";

        return `
            <tr>
                <td><span class="document-trace-badge">${label}</span></td>
                <td>${preciit.document_trace.value(change.table_label)}</td>
                <td>${preciit.document_trace.value(change.row)}</td>
                <td>-</td>
                <td>-</td>
                <td>${preciit.document_trace.render_details(change.details)}</td>
            </tr>
        `;
    }

    return "";
};

preciit.document_trace.render_source = function(event) {
    if (!event.source_doctype && !event.source_name) {
        return "";
    }

    if (event.source_doctype && event.source_name) {
        return `
            <button
                class="document-trace-link"
                data-trace-doctype="${preciit.document_trace.escape(event.source_doctype)}"
                data-trace-name="${preciit.document_trace.escape(event.source_name)}">
                Source: ${preciit.document_trace.value(event.source_doctype)} ${preciit.document_trace.value(event.source_name)}
            </button>
        `;
    }

    return `
        <span>
            Source: ${preciit.document_trace.value(event.source_name)}
        </span>
    `;
};

preciit.document_trace.render_details = function(details) {
    if (!details || !details.length) {
        return `<span class="document-trace-muted">No row details</span>`;
    }

    return `
        <div class="document-trace-details">
            ${details.map(function(detail) {
                return `
                    <span class="document-trace-detail">
                        <b>${preciit.document_trace.value(detail.label)}:</b>
                        ${preciit.document_trace.value(detail.value)}
                    </span>
                `;
            }).join("")}
        </div>
    `;
};

preciit.document_trace.bind_links = function(dialog) {
    dialog.$wrapper.find("[data-trace-doctype]").on("click", function() {
        frappe.set_route(
            "Form",
            $(this).attr("data-trace-doctype"),
            $(this).attr("data-trace-name")
        );
    });
};

preciit.document_trace.value = function(value) {
    if (value === null || value === undefined || value === "") {
        return `<span class="document-trace-muted">Blank</span>`;
    }

    return preciit.document_trace.escape(value).replace(/\n/g, "<br>");
};

preciit.document_trace.escape = function(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (frappe.utils && frappe.utils.escape_html) {
        return frappe.utils.escape_html(String(value));
    }

    return $("<div>").text(String(value)).html();
};

if (!preciit.document_trace.handlers_registered) {
    Object.keys(preciit.document_trace.configs).forEach(function(doctype) {
        frappe.ui.form.on(doctype, {
            refresh(frm) {
                let config = preciit.document_trace.configs[frm.doctype];

                if (!config) {
                    return;
                }

                frm.remove_custom_button(config.button_label);

                if (!frm.is_new()) {
                    frm.add_custom_button(config.button_label, function() {
                        preciit.document_trace.show(frm, config);
                    });
                }
            }
        });
    });

    preciit.document_trace.handlers_registered = true;
}
