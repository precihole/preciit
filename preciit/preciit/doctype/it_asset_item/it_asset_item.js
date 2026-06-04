// Copyright (c) 2026, Shubham Mishra and contributors

// For license information, please see license.txt

// frappe.ui.form.on("IT Asset Item", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on("IT Asset Item", {
    refresh(frm) {
        // Show custom status color
        setTimeout(() => {
            frm.page.clear_indicator();

            if (frm.doc.status) {
                frm.page.set_indicator(
                    frm.doc.status,
                    get_status_color(frm.doc.status)
                );
            }
        }, 100);

        // Always remove custom buttons first
        remove_action_buttons(frm);

        if (frm.is_new()) return;

        const is_submitted = frm.doc.docstatus === 1;
        const status = frm.doc.status;

        if (!is_submitted) return;

        // Configure Software
        if (status === "Instock") {
            frm.add_custom_button("Configure Software", () => {
                frappe.new_doc("IT Software Configuration", {
                    it_asset_item: frm.doc.name
                });
            }, "Actions");
        }

        // These buttons show only when status is Available
        if (status === "Available") {
            // Allocate Asset
            frm.add_custom_button("Allocate Asset", () => {
                frappe.new_doc("IT Asset Allocation", {
                    assigned_device: [
                        {
                            it_asset_item: frm.doc.name
                        }
                    ]
                });
            }, "Actions");

            // Send for Repair
            frm.add_custom_button("Send for Repair", () => {
                frappe.new_doc("IT Asset Repair", {
                    it_asset_item: frm.doc.name,
                    company: frm.doc.company
                });

                frappe.route_hooks.after_load = (repair_frm) => {
                    repair_frm.clear_table("asset_repair_item_details");

                    (frm.doc.device_configuration || []).forEach((d) => {
                        let child = repair_frm.add_child(
                            "asset_repair_item_details"
                        );

                        child.device_configuration_row_id = d.name;
                        child.component_brand_name = d.component_brand_name;
                        child.component_type = d.component_type;
                        child.component_name = d.component_name;
                        child.component_category = d.component_category;
                        child.component_model = d.component_model;
                        child.component_serial_number = d.component_serial_number;
                        child.component_capacity = d.component_capacity;
                        child.component_speed = d.component_speed;
                        child.status = d.status;
                        child.component_warrenty__expiry_date = d.component_warrenty__expiry_date;
                        child.component_purchase_date = d.component_purchase_date;
                        child.component_condition = d.component_condition;
                        child.component_quantity = d.component_quantity;
                        child.component_specification = d.component_specification;
                        child.remarks = d.remarks;
                    });

                    repair_frm.refresh_field("asset_repair_item_details");
                    frappe.route_hooks.after_load = null;
                };
            }, "Actions");

            // Decommission Asset
            frm.add_custom_button("Decommission Asset", () => {
                frappe.new_doc("IT Asset Decommissioning", {}, (doc) => {
                    let row = frappe.model.add_child(
                        doc,
                        "it_asset_decommissioning"
                    );

                    row.it_asset_item = frm.doc.name;
                });
            }, "Actions");
        }
    },

    validate(frm) {
        validate_child_table(frm, true);
    }
});


// ==============================
// REMOVE ACTION BUTTONS
// ==============================

function remove_action_buttons(frm) {
    [
        "Configure Software",
        "Allocate Asset",
        "Send for Repair",
        "Decommission Asset"
    ].forEach((button) => {
        frm.remove_custom_button(button, "Actions");
    });
}

// =====================================
// 🎨 STATUS COLORS
// ====================================
function get_status_color(status) {

    const status_colors = {

        "Draft": "gray",

        "Instock": "green",

        "Available": "cyan",

        "Software Configured": "blue",

        "Allocated": "blue",

        "Transfer": "pink",

        "Under Repair": "yellow",

        "Decommissioned": "red",

        "Cancelled": "red"
    };

    return status_colors[status] || "red";
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

frappe.ui.form.on("IT Network Interface Controller Details", {

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


//Pipline of IT Asset Statuses==============================================================================

frappe.ui.form.on("IT Asset Item", {
    refresh(frm) {

        frm.dashboard.clear_headline();

        frm.dashboard.set_headline(`

<style>

.form-message.blue{
    border:none !important;
    color:inherit !important;
    background:transparent !important;
}

/* ===================================
   DARK MODE
=================================== */

[data-theme="dark"] .form-message.blue{
    border:none !important;
    color:#e5e7eb !important;
    background:#171717 !important;
}

/* ===================================
   REMOVE ERPNext BACKGROUND
=================================== */

.layout-main-section,
.form-dashboard-section,
.form-dashboard{
    background:transparent !important;
    border:none !important;
    box-shadow:none !important;
}

/* ===================================
   WRAPPER
=================================== */

.asset-pipeline-wrapper{
    width:100%;
    overflow-x:auto;
    padding:10px 0;
    background:transparent;
}

/* ===================================
   MAIN CONTAINER
=================================== */

.asset-pipeline{
    position:relative;
    width:1020px;
    height:260px;
    margin:auto;
    background:transparent;
    border:none;
    border-radius:18px;
}

/* ===================================
   BOX STYLE
=================================== */

.asset-node{
    position:absolute;
    padding:7px 15px;
    border-radius:14px;
    background:#ffffff;
    border:2px solid;
    font-size:11px;
    font-weight:600;
    color:#334155;
    white-space:nowrap;
    z-index:2;
    box-shadow:0 2px 8px rgba(0,0,0,0.05);
    transition:0.25s ease;
    cursor:pointer;
}

.asset-node:hover{
    transform:translateY(-2px);
}

.asset-node-count{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width:18px;
    height:18px;
    margin-left:6px;
    padding:0 5px;
    border-radius:999px;
    background:#f1f5f9;
    color:#475569;
    font-size:10px;
    font-weight:700;
    line-height:1;
    vertical-align:middle;
}

.asset-node[class*="active-"] .asset-node-count{
    background:rgba(255,255,255,0.24);
    color:#fff;
}

[data-theme="dark"] .asset-node{
    background:#171717;
    color:#e5e7eb;
}

[data-theme="dark"] .asset-node-count{
    background:#27272a;
    color:#e5e7eb;
}

[data-theme="dark"] .asset-node[class*="active-"] .asset-node-count{
    background:rgba(255,255,255,0.24);
    color:#fff;
}

/* ===================================
   COLORS
=================================== */

.draft{
    border-color:#a855f7;
}

.stock{
    border-color:#3b82f6;
}

.config{
    border-color:#14b8a6;
}

.available{
    border-color:#22c55e;
}

.transfer{
    border-color:#f59e0b;
}

.allocate{
    border-color:#ef4444;
}

.repair{
    border-color:#06b6d4;
}

.decommissioned{
    border-color:#64748b;
}

/* ===================================
   ACTIVE STATUS FILL
=================================== */

.active-draft{
    background:#a855f7 !important;
    color:#fff !important;
}

.active-stock{
    background:#3b82f6 !important;
    color:#fff !important;
}

.active-config{
    background:#14b8a6 !important;
    color:#fff !important;
}

.active-available{
    background:#22c55e !important;
    color:#fff !important;
}

.active-transfer{
    background:#f59e0b !important;
    color:#fff !important;
}

.active-allocate{
    background:#ef4444 !important;
    color:#fff !important;
}

.active-repair{
    background:#06b6d4 !important;
    color:#fff !important;
}

.active-decommissioned{
    background:#64748b !important;
    color:#fff !important;
}

/* ===================================
   POSITIONS
=================================== */

#draft{
    top:115px;
    left:20px;
}

#stock{
    top:115px;
    left:130px;
}

#config{
    top:115px;
    left:255px;
}

#available{
    top:115px;
    left:395px;
}

#transfer{
    top:40px;
    left:540px;
}

#transfer_return{
    top:40px;
    left:700px;
}

#allocated{
    top:190px;
    left:540px;
}

#deallocated{
    top:190px;
    left:700px;
}

#repair{
    top:115px;
    left:860px;
}

#decommissioned{
    top:190px;
    left:860px;
}

/* ===================================
   SVG
=================================== */

.asset-pipeline svg{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    pointer-events:none;
    z-index:1;
}

/* ===================================
   FLOW LINE
=================================== */

.flow{
    fill:none;
    stroke:#cbd5e1;
    stroke-width:2.5;
    stroke-linecap:round;
    stroke-linejoin:round;
    stroke-dasharray:5 5;
    animation:flowMove 15s linear infinite;
}

/* ===================================
   ACTIVE FLOW
=================================== */

.active-flow{
    stroke:#22c55e !important;
}

/* ===================================
   FLOW ANIMATION
=================================== */

@keyframes flowMove{
    from{
        stroke-dashoffset:0;
    }
    to{
        stroke-dashoffset:-1000;
    }
}

</style>

<div class="asset-pipeline-wrapper">

<div class="asset-pipeline">

<svg>

    <!-- Draft -> Stock -->
    <path class="flow ${frm.doc.status!='Draft' ? 'active-flow' : ''}"
        d="M 102 129
           C 112 129, 120 129, 130 129"/>

    <!-- Stock -> Config -->
    <path class="flow ${['Configured','Available','Transfer','Transfer Return','Allocated','Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 230 129
           C 240 129, 245 129, 255 129"/>

    <!-- Config -> Available -->
    <path class="flow ${['Available','Transfer','Transfer Return','Allocated','Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 360 129
           C 372 129, 383 129, 395 129"/>

    <!-- Available -> Transfer -->
    <path class="flow ${['Transfer','Transfer Return'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 505 129
           C 528 129, 516 54, 540 54"/>

    <!-- Transfer -> Transfer Return -->
    <path class="flow ${frm.doc.status=='Transfer Return' ? 'active-flow' : ''}"
        d="M 637 54
           C 658 54, 679 54, 700 54"/>

    <!-- Available -> Allocated -->
    <path class="flow ${['Allocated','Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 505 129
           C 528 129, 516 204, 540 204"/>

    <!-- Allocated -> Deallocated -->
    <path class="flow ${['Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 642 204
           C 661 204, 681 204, 700 204"/>

    <!-- Deallocated -> Under Repair -->
    <path class="flow ${frm.doc.status=='Under Repair' ? 'active-flow' : ''}"
        d="M 826 204
           C 850 204, 838 129, 860 129"/>

    <!-- Deallocated -> Decommissioned -->
    <path class="flow ${frm.doc.status=='Decommissioned' ? 'active-flow' : ''}"
        d="M 826 204
           C 838 204, 848 204, 860 204"/>

</svg>

<!-- BOXES -->

<div class="asset-node draft ${frm.doc.status=='Draft' ? 'active-draft' : ''}" 
     id="draft"
     data-pipeline-node="draft">
    Draft
    <span class="asset-node-count" data-pipeline-count="draft">0</span>
</div>

<div class="asset-node stock ${frm.doc.status=='Instock' ? 'active-stock' : ''}" 
     id="stock"
     data-pipeline-node="stock">
    In Stock
    <span class="asset-node-count" data-pipeline-count="stock">0</span>
</div>

<div class="asset-node config ${frm.doc.status=='Configured' ? 'active-config' : ''}" 
     id="config"
     data-pipeline-node="config">
    SW Config
    <span class="asset-node-count" data-pipeline-count="config">0</span>
</div>

<div class="asset-node available ${frm.doc.status=='Available' ? 'active-available' : ''}" 
     id="available"
     data-pipeline-node="available">
    Available
    <span class="asset-node-count" data-pipeline-count="available">0</span>
</div>

<div class="asset-node transfer ${frm.doc.status=='Transfer' ? 'active-transfer' : ''}" 
     id="transfer"
     data-pipeline-node="transfer">
    Transfer
    <span class="asset-node-count" data-pipeline-count="transfer">0</span>
</div>

<div class="asset-node transfer ${frm.doc.status=='Transfer Return' ? 'active-transfer' : ''}" 
     id="transfer_return"
     data-pipeline-node="transfer_return">
    Transfer Return
    <span class="asset-node-count" data-pipeline-count="transfer_return">0</span>
</div>

<div class="asset-node allocate ${frm.doc.status=='Allocated' ? 'active-allocate' : ''}" 
     id="allocated"
     data-pipeline-node="allocated">
    Allocated
    <span class="asset-node-count" data-pipeline-count="allocated">0</span>
</div>

<div class="asset-node allocate ${frm.doc.status=='Deallocated' ? 'active-allocate' : ''}" 
     id="deallocated"
     data-pipeline-node="deallocated">
    Deallocated
    <span class="asset-node-count" data-pipeline-count="deallocated">0</span>
</div>

<div class="asset-node repair ${frm.doc.status=='Under Repair' ? 'active-repair' : ''}" 
     id="repair"
     data-pipeline-node="repair">
    Repair
    <span class="asset-node-count" data-pipeline-count="repair">0</span>
</div>

<div class="asset-node decommissioned ${frm.doc.status=='Decommissioned' ? 'active-decommissioned' : ''}" 
     id="decommissioned"
     data-pipeline-node="decommissioned">

    Decommission
    <span class="asset-node-count" data-pipeline-count="decommissioned">0</span>

</div>

</div>
</div>

        `);

        setup_asset_pipeline_actions(frm);
        load_asset_pipeline_documents(frm);
    }
});

function setup_asset_pipeline_actions(frm) {
    let $pipeline = get_asset_pipeline_wrapper(frm);

    $pipeline
        .off("click.asset_pipeline")
        .on("click.asset_pipeline", ".asset-node", function () {
            open_asset_pipeline_node(
                frm,
                $(this).attr("data-pipeline-node")
            );
        });
}

function load_asset_pipeline_documents(frm) {
    frm.asset_pipeline_request_id =
        (frm.asset_pipeline_request_id || 0) + 1;

    let request_id = frm.asset_pipeline_request_id;
    let documents = get_empty_asset_pipeline_documents();

    if (!frm.is_new() && frm.doc.name) {
        add_current_asset_status_document(frm, documents);
    }

    frm.asset_pipeline_documents = documents;
    update_asset_pipeline_counts(frm, documents);

    if (frm.is_new() || !frm.doc.name) {
        return;
    }

    Promise.all([
        get_optional_asset_pipeline_docs(
            "IT Asset Transfer",
            frm.doc.name
        ).then(docs => ["transfer", docs]),

        get_optional_asset_pipeline_docs(
            "IT Asset Transfer Return",
            frm.doc.name
        ).then(docs => ["transfer_return", docs]),

        get_asset_pipeline_docs(
            "IT Software Configuration",
            [
                [
                    "IT Software Configuration",
                    "it_asset_item",
                    "=",
                    frm.doc.name
                ]
            ],
            get_asset_pipeline_fields_for_doctype("IT Software Configuration")
        ).then(docs => ["config", docs]),

        get_asset_pipeline_docs(
            "IT Asset Allocation",
            [
                [
                    "IT System Configuration Item",
                    "it_asset_item",
                    "=",
                    frm.doc.name
                ],
                [
                    "IT System Configuration Item",
                    "parenttype",
                    "=",
                    "IT Asset Allocation"
                ],
                [
                    "IT System Configuration Item",
                    "parentfield",
                    "=",
                    "assigned_device"
                ]
            ],
            get_asset_pipeline_fields_for_doctype("IT Asset Allocation")
        ).then(docs => ["allocated", docs]),

        get_asset_pipeline_docs(
            "IT Asset Allocation",
            [
                [
                    "IT System Configuration Item",
                    "it_asset_item",
                    "=",
                    frm.doc.name
                ],
                [
                    "IT System Configuration Item",
                    "parenttype",
                    "=",
                    "IT Asset Allocation"
                ],
                [
                    "IT System Configuration Item",
                    "parentfield",
                    "=",
                    "assigned_device"
                ],
                [
                    "IT System Configuration Item",
                    "status",
                    "=",
                    "Deallocated"
                ]
            ],
            get_asset_pipeline_fields_for_doctype("IT Asset Allocation")
        ).then(docs => ["deallocated", docs]),

        get_asset_pipeline_docs(
            "IT Asset Repair",
            [
                [
                    "IT Asset Repair",
                    "it_asset_item",
                    "=",
                    frm.doc.name
                ]
            ],
            get_asset_pipeline_fields_for_doctype("IT Asset Repair")
        ).then(docs => ["repair", docs]),

        get_asset_pipeline_docs(
            "IT Asset Decommissioning",
            [
                [
                    "IT System Configuration Item",
                    "it_asset_item",
                    "=",
                    frm.doc.name
                ],
                [
                    "IT System Configuration Item",
                    "parenttype",
                    "=",
                    "IT Asset Decommissioning"
                ],
                [
                    "IT System Configuration Item",
                    "parentfield",
                    "=",
                    "it_asset_decommissioning"
                ]
            ],
            get_asset_pipeline_fields_for_doctype("IT Asset Decommissioning")
        ).then(docs => ["decommissioned", docs])
    ]).then(results => {
        if (request_id !== frm.asset_pipeline_request_id) {
            return;
        }

        results.forEach(([key, docs]) => {
            documents[key] = docs;
        });

        frm.asset_pipeline_documents = documents;
        update_asset_pipeline_counts(frm, documents);
    });
}

function get_asset_pipeline_docs(doctype, filters, fields) {
    return frappe.db.get_list(doctype, {
        fields: fields || [
            "name",
            "docstatus",
            "modified"
        ],
        filters: filters,
        order_by: "modified desc",
        limit: 1000
    }).then(rows => {
        return deduplicate_asset_pipeline_docs(
            (rows || []).map(row => ({
                doctype: doctype,
                name: row.name,
                status: row.status,
                docstatus: row.docstatus,
                modified: row.modified
            }))
        );
    }).catch(() => {
        return [];
    });
}

function get_optional_asset_pipeline_docs(doctype, asset_name) {
    return frappe.db.exists("DocType", doctype)
        .then(exists => {
            if (!exists) {
                return [];
            }

            return frappe.model.with_doctype(doctype).then(() => {
                let meta = frappe.get_meta(doctype);
                let fields = get_asset_pipeline_fields_for_doctype(doctype);
                let loaders = [];

                if (has_asset_pipeline_field(meta, "it_asset_item")) {
                    loaders.push(
                        get_asset_pipeline_docs(
                            doctype,
                            [
                                [
                                    doctype,
                                    "it_asset_item",
                                    "=",
                                    asset_name
                                ]
                            ],
                            fields
                        )
                    );
                }

                ((meta && meta.fields) || [])
                    .filter(df => {
                        return (
                            ["Table", "Table MultiSelect"].includes(df.fieldtype) &&
                            df.options === "IT System Configuration Item"
                        );
                    })
                    .forEach(df => {
                        loaders.push(
                            get_asset_pipeline_docs(
                                doctype,
                                [
                                    [
                                        "IT System Configuration Item",
                                        "it_asset_item",
                                        "=",
                                        asset_name
                                    ],
                                    [
                                        "IT System Configuration Item",
                                        "parenttype",
                                        "=",
                                        doctype
                                    ],
                                    [
                                        "IT System Configuration Item",
                                        "parentfield",
                                        "=",
                                        df.fieldname
                                    ]
                                ],
                                fields
                            )
                        );
                    });

                if (!loaders.length) {
                    return [];
                }

                return Promise.all(loaders).then(results => {
                    return deduplicate_asset_pipeline_docs(
                        [].concat.apply([], results)
                    );
                });
            });
        })
        .catch(() => {
            return [];
        });
}

function get_asset_pipeline_fields_for_doctype(doctype) {
    let meta = frappe.get_meta(doctype);

    if (!meta || !meta.fields) {
        return [
            "name",
            "status",
            "docstatus",
            "modified"
        ];
    }

    let fields = [
        "name",
        "docstatus",
        "modified"
    ];

    if (has_asset_pipeline_field(meta, "status")) {
        fields.splice(1, 0, "status");
    }

    return fields;
}

function has_asset_pipeline_field(meta, fieldname) {
    if (!meta || !meta.fields) {
        return false;
    }

    return (meta.fields || []).some(df => df.fieldname === fieldname);
}

function get_empty_asset_pipeline_documents() {
    return {
        draft: [],
        stock: [],
        config: [],
        available: [],
        transfer: [],
        transfer_return: [],
        allocated: [],
        deallocated: [],
        repair: [],
        decommissioned: []
    };
}

function add_current_asset_status_document(frm, documents) {
    let status_key = {
        "Draft": "draft",
        "Instock": "stock",
        "Available": "available"
    }[frm.doc.status];

    if (!status_key) {
        return;
    }

    documents[status_key] = [
        {
            doctype: frm.doctype,
            name: frm.doc.name,
            status: frm.doc.status,
            docstatus: frm.doc.docstatus,
            modified: frm.doc.modified
        }
    ];
}

function update_asset_pipeline_counts(frm, documents) {
    let $pipeline = get_asset_pipeline_wrapper(frm);

    Object.keys(get_empty_asset_pipeline_documents()).forEach(key => {
        $pipeline
            .find(`[data-pipeline-count="${key}"]`)
            .text((documents[key] || []).length);
    });
}

function open_asset_pipeline_node(frm, key) {
    let documents = frm.asset_pipeline_documents || {};
    let docs = documents[key] || [];

    if (!docs.length) {
        open_asset_pipeline_fallback(frm, key);
        return;
    }

    if (docs.length === 1) {
        open_asset_pipeline_document(docs[0]);
        return;
    }

    show_asset_pipeline_document_picker(key, docs);
}

function open_asset_pipeline_fallback(frm, key) {
    let routes = {
        draft: () => frappe.set_route("List", "IT Asset Item"),
        stock: () => frappe.set_route("List", "IT Asset Item"),
        config: () => frappe.set_route("List", "IT Software Configuration"),
        available: () => frappe.set_route(
            "List",
            "IT Asset Item",
            {
                status: "Available"
            }
        ),
        transfer: () => frappe.set_route("List", "IT Asset Transfer"),
        transfer_return: () => frappe.set_route(
            "List",
            "IT Asset Transfer Return"
        ),
        allocated: () => frappe.set_route("List", "IT Asset Allocation"),
        deallocated: () => frappe.set_route("List", "IT Asset Allocation"),
        repair: () => frappe.set_route("List", "IT Asset Repair"),
        decommissioned: () => frappe.set_route(
            "List",
            "IT Asset Decommissioning",
            {
                it_asset_item: frm.doc.name
            }
        )
    };

    if (routes[key]) {
        routes[key]();
    }
}

function show_asset_pipeline_document_picker(key, docs) {
    let dialog = new frappe.ui.Dialog({
        title: `${get_asset_pipeline_label(key)} Documents`,
        size: "large",
        fields: [
            {
                fieldtype: "HTML",
                fieldname: "documents"
            }
        ]
    });

    dialog.fields_dict.documents.$wrapper.html(`
        <style>
            .asset-pipeline-picker{
                border:1px solid #e5e7eb;
                border-radius:8px;
                overflow:hidden;
            }

            .asset-pipeline-picker-row{
                width:100%;
                display:grid;
                grid-template-columns:minmax(180px,1.4fr) minmax(120px,0.8fr) minmax(150px,1fr);
                gap:12px;
                align-items:center;
                border:0;
                border-bottom:1px solid #f3f4f6;
                background:#fff;
                padding:10px 12px;
                text-align:left;
                cursor:pointer;
            }

            .asset-pipeline-picker-row:last-child{
                border-bottom:0;
            }

            .asset-pipeline-picker-row:hover{
                background:#f8fafc;
            }

            .asset-pipeline-picker-name{
                font-weight:700;
                color:#111827;
                overflow-wrap:anywhere;
            }

            .asset-pipeline-picker-muted{
                color:#6b7280;
                font-size:12px;
                overflow-wrap:anywhere;
            }

            .asset-pipeline-picker-status{
                justify-self:start;
                border-radius:999px;
                padding:3px 9px;
                background:#eef2ff;
                color:#3730a3;
                font-size:11px;
                font-weight:700;
            }

            @media (max-width: 768px) {
                .asset-pipeline-picker-row{
                    grid-template-columns:1fr;
                    gap:6px;
                }
            }
        </style>

        <div class="asset-pipeline-picker">
            ${docs.map(render_asset_pipeline_picker_row).join("")}
        </div>
    `);

    dialog.fields_dict.documents.$wrapper
        .find("[data-pipeline-doctype]")
        .on("click", function () {
            dialog.hide();
            open_asset_pipeline_document({
                doctype: $(this).attr("data-pipeline-doctype"),
                name: $(this).attr("data-pipeline-name")
            });
        });

    dialog.show();
}

function render_asset_pipeline_picker_row(doc) {
    return `
        <button
            type="button"
            class="asset-pipeline-picker-row"
            data-pipeline-doctype="${asset_pipeline_escape(doc.doctype)}"
            data-pipeline-name="${asset_pipeline_escape(doc.name)}">
            <span>
                <span class="asset-pipeline-picker-name">
                    ${asset_pipeline_value(doc.name)}
                </span>
                <span class="asset-pipeline-picker-muted">
                    ${asset_pipeline_value(doc.doctype)}
                </span>
            </span>
            <span class="asset-pipeline-picker-status">
                ${asset_pipeline_value(
                    doc.status || get_asset_pipeline_docstatus(doc.docstatus)
                )}
            </span>
            <span class="asset-pipeline-picker-muted">
                ${asset_pipeline_value(format_asset_pipeline_datetime(doc.modified))}
            </span>
        </button>
    `;
}

function open_asset_pipeline_document(doc) {
    if (!doc || !doc.doctype || !doc.name) {
        return;
    }

    frappe.set_route(
        "Form",
        doc.doctype,
        doc.name
    );
}

function deduplicate_asset_pipeline_docs(docs) {
    let seen = {};

    return docs.filter(doc => {
        let key = `${doc.doctype}:${doc.name}`;

        if (seen[key]) {
            return false;
        }

        seen[key] = true;
        return true;
    });
}

function get_asset_pipeline_wrapper(frm) {
    let $base = frm.dashboard && frm.dashboard.wrapper
        ? $(frm.dashboard.wrapper)
        : $(frm.wrapper);

    return $base.find(".asset-pipeline-wrapper");
}

function get_asset_pipeline_label(key) {
    return {
        draft: "Draft",
        stock: "In Stock",
        config: "SW Config",
        available: "Available",
        transfer: "Transfer",
        transfer_return: "Transfer Return",
        allocated: "Allocated",
        deallocated: "Deallocated",
        repair: "Repair",
        decommissioned: "Decommission"
    }[key] || "Linked";
}

function get_asset_pipeline_docstatus(docstatus) {
    return {
        0: "Draft",
        1: "Submitted",
        2: "Cancelled"
    }[docstatus] || "";
}

function format_asset_pipeline_datetime(value) {
    if (!value) {
        return "";
    }

    if (frappe.datetime && frappe.datetime.str_to_user) {
        return frappe.datetime.str_to_user(value);
    }

    return value;
}

function asset_pipeline_value(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    return asset_pipeline_escape(value);
}

function asset_pipeline_escape(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (frappe.utils && frappe.utils.escape_html) {
        return frappe.utils.escape_html(String(value));
    }

    return $("<div>").text(String(value)).html();
}

//===============================It Asset Trace==========================================================================

frappe.ui.form.on("IT Asset Item", {
    refresh: function (frm) {
        if (frm.is_new()) return;

        frm.add_custom_button("Asset Trace", function () {
            show_asset_trace_dialog(frm);
        });
    }
});


function show_asset_trace_dialog(frm) {
    let d = new frappe.ui.Dialog({
        title: "IT Asset Trace",
        size: "extra-large",
        fields: [
            {
                fieldtype: "HTML",
                fieldname: "asset_trace_html"
            }
        ]
    });

    d.show();

    d.fields_dict.asset_trace_html.$wrapper.html(`
        <div class="asset-trace-loading">
            Loading trace history...
        </div>
    `);

    frappe.call({
        method: "preciit.preciit.doctype.it_asset_item.it_asset_item.get_asset_item_trace",
        args: {
            asset_item: frm.doc.name
        },
        freeze: true,
        callback: function (r) {
            let trace = r.message || {};

            d.fields_dict.asset_trace_html.$wrapper.html(
                render_asset_trace(trace)
            );

            bind_asset_trace_links(d);
        }
    });
}


function render_asset_trace(trace) {
    let events = trace.events || [];

    let event_html = events.length
        ? events.map(render_asset_trace_event).join("")
        : `
            <div class="asset-trace-empty">
                No trace records found for this asset.
            </div>
        `;

    let track_note = trace.track_changes
        ? ""
        : `
            <div class="asset-trace-warning">
                Track Changes is not enabled in the database metadata yet.
                Run migrate or reload this DocType so future field and child-table saves are recorded.
            </div>
        `;

    return `
        <style>
            .asset-trace {
                color: #1f2937;
                max-height: 70vh;
                overflow: auto;
                padding: 4px 2px 8px;
            }

            .asset-trace-loading,
            .asset-trace-empty {
                padding: 24px;
                text-align: center;
                color: #6b7280;
            }

            .asset-trace-summary {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 14px;
            }

            .asset-trace-stat {
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 10px 12px;
                background: #ffffff;
            }

            .asset-trace-label {
                color: #6b7280;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
            }

            .asset-trace-value {
                margin-top: 4px;
                font-size: 14px;
                font-weight: 700;
                color: #111827;
                overflow-wrap: anywhere;
            }

            .asset-trace-warning {
                margin-bottom: 14px;
                padding: 10px 12px;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                background: #fffbeb;
                color: #92400e;
                font-size: 12px;
            }

            .asset-trace-timeline {
                border-left: 2px solid #d1d5db;
                margin-left: 12px;
                padding-left: 18px;
            }

            .asset-trace-event {
                position: relative;
                margin-bottom: 16px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                background: #ffffff;
            }

            .asset-trace-event:before {
                content: "";
                position: absolute;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #0f766e;
                border: 2px solid #ffffff;
                left: -25px;
                top: 16px;
                box-shadow: 0 0 0 1px #0f766e;
            }

            .asset-trace-event-head {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 12px 14px;
                border-bottom: 1px solid #f3f4f6;
                align-items: flex-start;
            }

            .asset-trace-title {
                font-size: 14px;
                font-weight: 700;
                color: #111827;
            }

            .asset-trace-meta {
                margin-top: 4px;
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                color: #6b7280;
                font-size: 12px;
            }

            .asset-trace-time {
                color: #374151;
                font-size: 12px;
                white-space: nowrap;
            }

            .asset-trace-link {
                border: 0;
                background: transparent;
                color: #2563eb;
                padding: 0;
                font-size: 12px;
                cursor: pointer;
            }

            .asset-trace-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                font-size: 12px;
            }

            .asset-trace-table th {
                text-align: left;
                padding: 9px 10px;
                border-bottom: 1px solid #f3f4f6;
                color: #6b7280;
                font-weight: 700;
                background: #f9fafb;
            }

            .asset-trace-table td {
                vertical-align: top;
                padding: 9px 10px;
                border-bottom: 1px solid #f9fafb;
                overflow-wrap: anywhere;
            }

            .asset-trace-table tr:last-child td {
                border-bottom: 0;
            }

            .asset-trace-badge {
                display: inline-flex;
                align-items: center;
                min-height: 22px;
                border-radius: 999px;
                padding: 2px 8px;
                font-size: 11px;
                font-weight: 700;
                background: #eef2ff;
                color: #3730a3;
            }

            .asset-trace-muted {
                color: #9ca3af;
                font-style: italic;
            }

            .asset-trace-details {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .asset-trace-detail {
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 4px 6px;
                background: #f9fafb;
            }

            @media (max-width: 768px) {
                .asset-trace-summary {
                    grid-template-columns: 1fr;
                }

                .asset-trace-event-head {
                    display: block;
                }

                .asset-trace-time {
                    margin-top: 8px;
                }

                .asset-trace-table {
                    min-width: 760px;
                }
            }
        </style>

        <div class="asset-trace">
            <div class="asset-trace-summary">
                <div class="asset-trace-stat">
                    <div class="asset-trace-label">Asset</div>
                    <div class="asset-trace-value">
                        ${asset_trace_value(trace.asset_item)}
                    </div>
                </div>

                <div class="asset-trace-stat">
                    <div class="asset-trace-label">Current Status</div>
                    <div class="asset-trace-value">
                        ${asset_trace_value(trace.current_status)}
                    </div>
                </div>

                <div class="asset-trace-stat">
                    <div class="asset-trace-label">Trace Records</div>
                    <div class="asset-trace-value">
                        ${events.length}
                    </div>
                </div>
            </div>

            ${track_note}

            <div class="asset-trace-timeline">
                ${event_html}
            </div>
        </div>
    `;
}


function render_asset_trace_event(event) {
    let source = render_asset_trace_source(event);

    let rows = (event.changes || [])
        .map(render_asset_trace_change)
        .join("");

    if (!rows) {
        rows = `
            <tr>
                <td colspan="6">
                    <span class="asset-trace-muted">No detailed changes found</span>
                </td>
            </tr>
        `;
    }

    return `
        <div class="asset-trace-event">
            <div class="asset-trace-event-head">
                <div>
                    <div class="asset-trace-title">
                        ${asset_trace_value(event.title)}
                    </div>

                    <div class="asset-trace-meta">
                        <span>By ${asset_trace_value(event.user)}</span>
                        ${source}
                    </div>
                </div>

                <div class="asset-trace-time">
                    ${asset_trace_value(event.timestamp_display)}
                </div>
            </div>

            <div style="overflow:auto;">
                <table class="asset-trace-table">
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


function render_asset_trace_change(change) {
    if (change.type === "field") {
        return `
            <tr>
                <td><span class="asset-trace-badge">Field</span></td>
                <td>-</td>
                <td>-</td>
                <td>${asset_trace_value(change.label)}</td>
                <td>${asset_trace_value(change.from)}</td>
                <td>${asset_trace_value(change.to)}</td>
            </tr>
        `;
    }

    if (change.type === "child_field") {
        return `
            <tr>
                <td><span class="asset-trace-badge">Child Field</span></td>
                <td>${asset_trace_value(change.table_label)}</td>
                <td>${asset_trace_value(change.row)}</td>
                <td>${asset_trace_value(change.label)}</td>
                <td>${asset_trace_value(change.from)}</td>
                <td>${asset_trace_value(change.to)}</td>
            </tr>
        `;
    }

    if (change.type === "row_added" || change.type === "row_removed") {
        let label = change.type === "row_added" ? "Row Added" : "Row Removed";

        return `
            <tr>
                <td><span class="asset-trace-badge">${label}</span></td>
                <td>${asset_trace_value(change.table_label)}</td>
                <td>${asset_trace_value(change.row)}</td>
                <td>-</td>
                <td>-</td>
                <td>${render_asset_trace_details(change.details)}</td>
            </tr>
        `;
    }

    return "";
}


function render_asset_trace_source(event) {
    if (!event.source_doctype && !event.source_name) {
        return "";
    }

    if (event.source_doctype && event.source_name) {
        return `
            <button
                type="button"
                class="asset-trace-link"
                data-trace-doctype="${asset_trace_escape(event.source_doctype)}"
                data-trace-name="${asset_trace_escape(event.source_name)}">
                Source: ${asset_trace_value(event.source_doctype)} ${asset_trace_value(event.source_name)}
            </button>
        `;
    }

    return `
        <span>
            Source: ${asset_trace_value(event.source_name)}
        </span>
    `;
}


function render_asset_trace_details(details) {
    if (!details || !details.length) {
        return `<span class="asset-trace-muted">No row details</span>`;
    }

    return `
        <div class="asset-trace-details">
            ${details.map(detail => `
                <span class="asset-trace-detail">
                    <b>${asset_trace_value(detail.label)}:</b>
                    ${asset_trace_value(detail.value)}
                </span>
            `).join("")}
        </div>
    `;
}


function bind_asset_trace_links(dialog) {
    dialog.$wrapper.find("[data-trace-doctype]").on("click", function () {
        frappe.set_route(
            "Form",
            $(this).attr("data-trace-doctype"),
            $(this).attr("data-trace-name")
        );
    });
}


function asset_trace_value(value) {
    if (value === null || value === undefined || value === "") {
        return `<span class="asset-trace-muted">Blank</span>`;
    }

    return asset_trace_escape(value).replace(/\n/g, "<br>");
}


function asset_trace_escape(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (frappe.utils && frappe.utils.escape_html) {
        return frappe.utils.escape_html(String(value));
    }

    return $("<div>").text(String(value)).html();
}
