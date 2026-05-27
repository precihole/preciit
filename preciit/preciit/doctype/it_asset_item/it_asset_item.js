// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

// frappe.ui.form.on("IT Asset Item", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("IT Asset Item", {

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
        if (frm.doc.docstatus === 1 && frm.doc.status == "Instock") {

            frm.add_custom_button("Configure Software", () => {

                frappe.new_doc("IT Software Configuration", {
                    it_asset_item: frm.doc.name
                });

            }, "Actions");
        }

        // ==============================
        // ✅ ASSIGN TO USER
        // ==============================
        if (frm.doc.docstatus === 1 && frm.doc.status == "Available") {

            frm.add_custom_button("Allocate Asset", () => {

                frappe.new_doc("IT Asset Allocation", {

                    assigned_device: [
                        {
                            it_asset_item: frm.doc.name
                        }
                    ]

                });

            }, "Actions");
        }

                // ==============================
                // ✅ DECOMMISSION
                // ==============================
                if (
                    frm.doc.docstatus === 1 &&
                    frm.doc.status != "Allocated" &&
                    frm.doc.status != "Decommissioned" &&
                    frm.doc.status != "Transfer" &&
                    frm.doc.status != "Under Repair"
                ) {

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


                // ==============================
                // ✅ SEND FOR REPAIR
                // ==============================
               if (
                    (frm.doc.docstatus === 1 && frm.doc.status == "Instock") ||
                    (frm.doc.docstatus === 1 && frm.doc.status == "Available") ||
                    (frm.doc.docstatus === 1 && frm.doc.status != "Under Repair")
                ) {

                    frm.add_custom_button("Send for Repair", () => {

                        frappe.new_doc("IT Asset Repair", {
                            it_asset_item: frm.doc.name,
                            company: frm.doc.company
                        });

                        frappe.route_hooks.after_load = (repair_frm) => {

                            // =========================
                            // CLEAR CHILD TABLE
                            // =========================
                            repair_frm.clear_table(
                                "asset_repair_item_details"
                            );

                            // =========================
                            // ADD CHILD ROWS
                            // =========================
                            (frm.doc.device_configuration || []).forEach(d => {

                                let child = repair_frm.add_child(
                                    "asset_repair_item_details"
                                );
                                
                                child.device_configuration_row_name = d.name;

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

                            // =========================
                            // REFRESH CHILD TABLE
                            // =========================
                            repair_frm.refresh_field(
                                "asset_repair_item_details"
                            );

                            // REMOVE HOOK
                            frappe.route_hooks.after_load = null;
                        };

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

        "Decommissioned": "red" 
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


//===============================================================================pipeline==========================================================================
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
    width:840px;
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
    left:100px;
}

#config{
    top:115px;
    left:190px;
}

#available{
    top:115px;
    left:300px;
}

#transfer{
    top:40px;
    left:420px;
}

#transfer_return{
    top:40px;
    left:560px;
}

#allocated{
    top:190px;
    left:420px;
}

#deallocated{
    top:190px;
    left:550px;
}

#repair{
    top:115px;
    left:700px;
}

#decommissioned{
    top:190px;
    left:700px;
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
        d="M 68 129
           C 78 129, 90 129, 100 129"/>

    <!-- Stock -> Config -->
    <path class="flow ${['Configured','Available','Transfer','Transfer Return','Allocated','Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 163 129
           C 173 129, 180 129, 190 129"/>

    <!-- Config -> Available -->
    <path class="flow ${['Available','Transfer','Transfer Return','Allocated','Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 271 129
           C 281 129, 290 129, 300 129"/>

    <!-- Available -> Transfer -->
    <path class="flow ${['Transfer','Transfer Return'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 373 129
           C 395 129, 400 54, 420 54"/>

    <!-- Transfer -> Transfer Return -->
    <path class="flow ${frm.doc.status=='Transfer Return' ? 'active-flow' : ''}"
        d="M 500 54
           C 520 54, 540 54, 560 54"/>

    <!-- Available -> Allocated -->
    <path class="flow ${['Allocated','Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 373 129
           C 395 129, 400 204, 420 204"/>

    <!-- Allocated -> Deallocated -->
    <path class="flow ${['Deallocated','Under Repair','Decommissioned'].includes(frm.doc.status) ? 'active-flow' : ''}"
        d="M 510 204
           C 520 204, 535 204, 550 204"/>

    <!-- Deallocated -> Under Repair -->
    <path class="flow ${frm.doc.status=='Under Repair' ? 'active-flow' : ''}"
        d="M 645 204
           C 675 204, 675 129, 700 129"/>

    <!-- Deallocated -> Decommissioned -->
    <path class="flow ${frm.doc.status=='Decommissioned' ? 'active-flow' : ''}"
        d="M 645 204
           C 660 204, 680 204, 700 204"/>

</svg>

<!-- BOXES -->

<div class="asset-node draft ${frm.doc.status=='Draft' ? 'active-draft' : ''}" 
     id="draft"
     onclick="frappe.set_route('List','IT Asset Item')">
    Draft
</div>

<div class="asset-node stock ${frm.doc.status=='Instock' ? 'active-stock' : ''}" 
     id="stock"
     onclick="frappe.set_route('List','IT Asset Item')">
    In Stock
</div>

<div class="asset-node config ${frm.doc.status=='Configured' ? 'active-config' : ''}" 
     id="config"
     onclick="frappe.set_route('List','IT Software Configuration')">
    SW Config
</div>

<div class="asset-node available ${frm.doc.status=='Available' ? 'active-available' : ''}" 
     id="available"
     onclick="frappe.set_route('List','IT Asset Item', {status:'Available'})">
    Available
</div>

<div class="asset-node transfer ${frm.doc.status=='Transfer' ? 'active-transfer' : ''}" 
     id="transfer"
     onclick="frappe.set_route('List','IT Asset Transfer')">
    Transfer
</div>

<div class="asset-node transfer ${frm.doc.status=='Transfer Return' ? 'active-transfer' : ''}" 
     id="transfer_return"
     onclick="frappe.set_route('List','IT Asset Transfer Return')">
    Transfer Return
</div>

<div class="asset-node allocate ${frm.doc.status=='Allocated' ? 'active-allocate' : ''}" 
     id="allocated"
     onclick="frappe.set_route('List','IT Asset Allocation')">
    Allocated
</div>

<div class="asset-node allocate ${frm.doc.status=='Deallocated' ? 'active-allocate' : ''}" 
     id="deallocated"
     onclick="frappe.set_route('List','IT Asset Allocation')">
    Deallocated
</div>

<div class="asset-node repair ${frm.doc.status=='Under Repair' ? 'active-repair' : ''}" 
     id="repair"
     onclick="frappe.set_route('List','IT Asset Repair')">
    Repair
</div>
x
<div class="asset-node decommissioned ${frm.doc.status=='Decommissioned' ? 'active-decommissioned' : ''}" 
     id="decommissioned"
     
     onclick="frappe.set_route(
        'List',
        'IT Asset Decommissioning',
        {
            it_asset_item: '${frm.doc.name}'
        }
     )">

    Decommission

</div>

</div>
</div>

        `);
    }
});




//===============================It Asset Trace==========================================================================
frappe.ui.form.on("IT Asset Item", {

    refresh(frm) {

        // REMOVE OLD BUTTON
        frm.remove_custom_button("Asset Life Cycle");

        // ADD BUTTON
        frm.add_custom_button("Asset Life Cycle", function() {

            let d = new frappe.ui.Dialog({

                title: "♻️ IT Asset Life Cycle",

                size: "large",

                fields: [
                    {
                        fieldtype: "HTML",
                        fieldname: "asset_lifecycle_html"
                    }
                ]
            });

            d.show();

            let html = `

            <div style="
                padding:20px;
                background:#ffffff;
                border-radius:16px;
            ">

                <div style="
                    font-size:22px;
                    font-weight:700;
                    margin-bottom:25px;
                    color:#111827;
                ">
                    ♻️ IT Asset Life Cycle
                </div>

                <style>

                    .asset-box{
                        position:relative;
                        margin-left:25px;
                        margin-bottom:20px;
                        border-left:3px solid #3b82f6;
                        padding-left:25px;
                    }

                    .asset-circle{
                        position:absolute;
                        left:-13px;
                        top:5px;
                        width:22px;
                        height:22px;
                        border-radius:50%;
                        background:#2563eb;
                        color:white;
                        font-size:12px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-weight:bold;
                    }

                    .asset-header{
                        background:#eff6ff;
                        padding:14px 18px;
                        border-radius:12px;
                        cursor:pointer;
                        font-weight:600;
                        transition:0.3s;
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                    }

                    .asset-header:hover{
                        background:#dbeafe;
                    }

                    .asset-body{
                        display:none;
                        padding:15px;
                        margin-top:10px;
                        background:#f9fafb;
                        border-radius:12px;
                        line-height:1.9;
                        color:#374151;
                    }

                    .asset-open .asset-body{
                        display:block;
                    }

                    .asset-arrow{
                        transition:0.3s;
                    }

                    .asset-open .asset-arrow{
                        transform:rotate(90deg);
                    }

                </style>

                <!-- STEP 0 -->

                <div class="asset-box">

                    <div class="asset-circle">0</div>

                    <div class="asset-header">
                        🟢 Initial Stage
                        <span class="asset-arrow">▶</span>
                    </div>

                    <div class="asset-body">
                        • Asset Request Created<br>
                        • Approval Started<br>
                        • Initial Entry Created
                    </div>

                </div>

                <!-- STEP 1 -->

                <div class="asset-box">

                    <div class="asset-circle">1</div>

                    <div class="asset-header">
                        💾 Device Saved
                        <span class="asset-arrow">▶</span>
                    </div>

                    <div class="asset-body">
                        • Device Configuration Added<br>
                        • Hardware Registered<br>
                        • Serial Number Saved
                    </div>

                </div>

                <!-- STEP 2 -->

                <div class="asset-box">

                    <div class="asset-circle">2</div>

                    <div class="asset-header">
                        👨‍💼 Asset Allocated
                        <span class="asset-arrow">▶</span>
                    </div>

                    <div class="asset-body">
                        • Employee Assigned<br>
                        • Department Linked<br>
                        • Allocation Completed
                    </div>

                </div>

                <!-- STEP 3 -->

                <div class="asset-box">

                    <div class="asset-circle">3</div>

                    <div class="asset-header">
                        ⚙️ In Use
                        <span class="asset-arrow">▶</span>
                    </div>

                    <div class="asset-body">
                        • Daily Operations Running<br>
                        • Device Active<br>
                        • Monitoring Enabled
                    </div>

                </div>

                <!-- STEP 4 -->

                <div class="asset-box">

                    <div class="asset-circle">4</div>

                    <div class="asset-header">
                        🔧 Under Repair
                        <span class="asset-arrow">▶</span>
                    </div>

                    <div class="asset-body">
                        • Issue Raised<br>
                        • Repair Started<br>
                        • Component Updated<br>
                        • Replacement Added
                    </div>

                </div>

                <!-- STEP 5 -->

                <div class="asset-box">

                    <div class="asset-circle">5</div>

                    <div class="asset-header">
                        ✅ Completed
                        <span class="asset-arrow">▶</span>
                    </div>

                    <div class="asset-body">
                        • Asset Available Again<br>
                        • Repair Completed<br>
                        • Device Tested Successfully
                    </div>

                </div>

                <!-- STEP 6 -->

                <div class="asset-box">

                    <div class="asset-circle">6</div>

                    <div class="asset-header">
                        ♻️ Retired
                        <span class="asset-arrow">▶</span>
                    </div>

                    <div class="asset-body">
                        • Asset Decommissioned<br>
                        • Scrap Process Started<br>
                        • Lifecycle Closed
                    </div>

                </div>

            </div>
            `;

            d.fields_dict.asset_lifecycle_html.$wrapper.html(html);

            d.$wrapper.find(".asset-header").on("click", function() {

                $(this)
                    .parent()
                    .toggleClass("asset-open");

            });

        });

    }

});




















































////////////////////////////////////old code
// frappe.ui.form.on("IT Asset Item", {
//     refresh(frm) {

//         frm.dashboard.clear_headline();

//         frm.dashboard.set_headline(`

// <style>
// // .form-message.blue {
// //     // border: 1px solid var(--blue-100);
// //     // color: var(--blue-800);
// //     background: none
// // }

// /* ===================================
//    REMOVE ERPNext BACKGROUND
// =================================== */

// .layout-main-section,
// .form-dashboard-section,
// .form-dashboard{
//     background:transparent !important;
//     border:none !important;
//     box-shadow:none !important;
// }

// /* ===================================
//    WRAPPER
// =================================== */

// .asset-pipeline-wrapper{
//     width:100%;
//     overflow-x:auto;
//     padding:10px 0;
//     background:#fff;
// }

// /* ===================================
//    MAIN CONTAINER
// =================================== */

// .asset-pipeline{
//     position:relative;
//     width:840px;
//     height:260px;
//     margin:auto;
//     background:transparent;
//     border:none;
//     border-radius:18px;
// }

// /* ===================================
//    BOX STYLE
// =================================== */

// .asset-node{
//     position:absolute;
//     padding:7px 15px;
//     border-radius:14px;
//     font-size:11px;
//     font-weight:700;
//     color:#ffffff;
//     white-space:nowrap;
//     z-index:2;
//     transition:0.25s ease;
//     border:none;
//     box-shadow:
//         0 3px 10px rgba(0,0,0,0.12),
//         inset 0 1px 1px rgba(255,255,255,0.15);
// }

// .asset-node:hover{
//     transform:translateY(-2px) scale(1.03);
// }

// /* ===================================
//    COLORFUL STATES
// =================================== */

// .draft{
//     background:linear-gradient(135deg,#c084fc,#7e22ce);
// }

// .stock{
//     background:linear-gradient(135deg,#60a5fa,#2563eb);
// }

// .config{
//     background:linear-gradient(135deg,#2dd4bf,#0f766e);
// }

// .available{
//     background:linear-gradient(135deg,#4ade80,#15803d);
// }

// .transfer{
//     background:linear-gradient(135deg,#fbbf24,#d97706);
// }

// .allocate{
//     background:linear-gradient(135deg,#fb7185,#be123c);
// }

// .repair{
//     background:linear-gradient(135deg,#22d3ee,#0e7490);
// }

// .decommissioned{
//     background:linear-gradient(135deg,#94a3b8,#475569);
// }

// /* ===================================
//    ACTIVE STATUS GLOW
// =================================== */

// .active-state{
//     transform:scale(1.08);
//     box-shadow:
//         0 0 0 3px rgba(25, 236, 10, 0.7),
//         0 0 30px rgba(34,197,94,0.6),
//         0 6px 18px rgba(0,0,0,0.2);
// }

// /* ===================================
//    POSITIONS
// =================================== */

// #draft{
//     top:115px;
//     left:20px;
// }

// #stock{
//     top:115px;
//     left:100px;
// }

// #config{
//     top:115px;
//     left:190px;
// }

// #available{
//     top:115px;
//     left:300px;
// }

// #transfer{
//     top:40px;
//     left:420px;
// }

// #transfer_return{
//     top:40px;
//     left:560px;
// }

// #allocated{
//     top:190px;
//     left:420px;
// }

// #deallocated{
//     top:190px;
//     left:550px;
// }

// #repair{
//     top:115px;
//     left:700px;
// }

// #decommissioned{
//     top:190px;
//     left:700px;
// }

// /* ===================================
//    SVG
// =================================== */

// .asset-pipeline svg{
//     position:absolute;
//     inset:0;
//     width:100%;
//     height:100%;
//     pointer-events:none;
//     z-index:1;
// }

// /* ===================================
//    FLOW LINE
// =================================== */

// .flow{
//     fill:none;
//     stroke:#d1d5db;
//     stroke-width:2.5;
//     stroke-linecap:round;
//     stroke-linejoin:round;
//     stroke-dasharray:5 5;
//     animation:flowMove 15s linear infinite;
// }

// /* ===================================
//    ACTIVE FLOW
// =================================== */

// .active-flow{
//     stroke:#22c55e !important;
//     filter:drop-shadow(0 0 5px rgba(34,197,94,0.5));
// }

// /* ===================================
//    FLOW ANIMATION
// =================================== */

// @keyframes flowMove{

//     from{
//         stroke-dashoffset:0;
//     }

//     to{
//         stroke-dashoffset:-1000;
//     }
// }

// </style>

// <div class="asset-pipeline-wrapper">

// <div class="asset-pipeline">

// <svg>

//     <!-- Draft -> Stock -->
//     <path class="flow ${frm.doc.status != "Draft" ? "active-flow" : ""}"
//         d="M 68 129
//            C 78 129, 90 129, 100 129"/>

//     <!-- Stock -> Config -->
//     <path class="flow ${["Configured","Available","Transfer","Transfer Return","Allocated","Deallocated","Repair","Decommissioned"].includes(frm.doc.status) ? "active-flow" : ""}"
//         d="M 163 129
//            C 173 129, 180 129, 190 129"/>

//     <!-- Config -> Available -->
//     <path class="flow ${["Available","Transfer","Transfer Return","Allocated","Deallocated","Repair","Decommissioned"].includes(frm.doc.status) ? "active-flow" : ""}"
//         d="M 271 129
//            C 281 129, 290 129, 300 129"/>

//     <!-- Available -> Transfer -->
//     <path class="flow ${["Transfer","Transfer Return"].includes(frm.doc.status) ? "active-flow" : ""}"
//         d="M 373 129
//            C 395 129, 400 54, 420 54"/>

//     <!-- Transfer -> Transfer Return -->
//     <path class="flow ${frm.doc.status == "Transfer Return" ? "active-flow" : ""}"
//         d="M 500 54
//            C 520 54, 540 54, 560 54"/>

//     <!-- Available -> Allocated -->
//     <path class="flow ${["Allocated","Deallocated","Repair","Decommissioned"].includes(frm.doc.status) ? "active-flow" : ""}"
//         d="M 373 129
//            C 395 129, 400 204, 420 204"/>

//     <!-- Allocated -> Deallocated -->
//     <path class="flow ${["Deallocated","Repair","Decommissioned"].includes(frm.doc.status) ? "active-flow" : ""}"
//         d="M 510 204
//            C 520 204, 535 204, 550 204"/>

//     <!-- Deallocated -> Repair -->
//     <path class="flow ${frm.doc.status == "Repair" ? "active-flow" : ""}"
//         d="M 645 204
//            C 675 204, 675 129, 700 129"/>

//     <!-- Deallocated -> Decommission -->
//     <path class="flow ${frm.doc.status == "Decommissioned" ? "active-flow" : ""}"
//         d="M 645 204
//            C 660 204, 680 204, 700 204"/>

// </svg>

// <!-- BOXES -->

// <div class="asset-node draft ${frm.doc.status=="Draft" ? "active-state" : ""}" id="draft">
//     Draft
// </div>

// <div class="asset-node stock ${frm.doc.status=="Instock" ? "active-state" : ""}" id="stock">
//     In Stock
// </div>

// <div class="asset-node config ${frm.doc.status=="Configured" ? "active-state" : ""}" id="config">
//     Configured
// </div>

// <div class="asset-node available ${frm.doc.status=="Available" ? "active-state" : ""}" id="available">
//     Available
// </div>

// <div class="asset-node transfer ${frm.doc.status=="Transfer" ? "active-state" : ""}" id="transfer">
//     Transfer
// </div>

// <div class="asset-node transfer ${frm.doc.status=="Transfer Return" ? "active-state" : ""}" id="transfer_return">
//     Transfer Return
// </div>

// <div class="asset-node allocate ${frm.doc.status=="Allocated" ? "active-state" : ""}" id="allocated">
//     Allocated
// </div>

// <div class="asset-node allocate ${frm.doc.status=="Deallocated" ? "active-state" : ""}" id="deallocated">
//     Deallocated
// </div>

// <div class="asset-node repair ${frm.doc.status=="Repair" ? "active-state" : ""}" id="repair">
//     Repair
// </div>

// <div class="asset-node decommissioned ${frm.doc.status=="Decommissioned" ? "active-state" : ""}" id="decommissioned">
//     Decommissioned
// </div>

// </div>
// </div>

//         `);
//     }
// });



