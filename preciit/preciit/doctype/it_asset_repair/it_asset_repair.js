// Copyright (c) 2026, Shubham Mishra and contributors
// For license information, please see license.txt

frappe.ui.form.on("IT Asset Repair", {
	refresh(frm) {
		// =====================================
		// CALCULATE TOTALS
		// =====================================

		calculate_total_component_repair_cost(frm);
		calculate_total_component_replace_cost(frm);

		// =====================================
		// REPAIR COMPLETED BUTTON
		// =====================================

		if (
			frm.doc.docstatus === 1 &&
			frm.doc.status === "Under Repair"
		) {
			frm.add_custom_button(
				__("Repair Completed"),
				function () {
					frappe.confirm(
						__("Are you sure you want to mark this repair as Completed?"),

						function () {
							frm.set_value("status", "Completed");

							frm.save().then(() => {
								frappe.show_alert({
									message: __("Repair marked as Completed"),
									indicator: "green"
								});
							});
						},

						function () {
							frappe.show_alert({
								message: __("Action Cancelled"),
								indicator: "orange"
							});
						}
					);
				}
			).addClass("btn-success");
		}
	},

	validate(frm) {
		calculate_total_component_repair_cost(frm);
		calculate_total_component_replace_cost(frm);
	}
});


// =====================================
// CHILD TABLE EVENTS - REPAIR ITEMS
// Child Doctype: IT Asset Repair Item
// Parent Table Fieldname: asset_repair_item_details
// =====================================

frappe.ui.form.on("IT Asset Repair Item", {
	component_repair_cost(frm, cdt, cdn) {
		calculate_total_component_repair_cost(frm);
	},

	component_condition_after_repair(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.component_condition_after_repair === "Scrap") {
			frappe.model.set_value(
				cdt,
				cdn,
				"component_condition",
				"Decommissioned"
			);
		} else {
			frappe.model.set_value(
				cdt,
				cdn,
				"component_condition",
				""
			);
		}
	}
});


// =====================================
// CHILD TABLE EVENTS - REPLACEMENT ITEMS
// IMPORTANT:
// Replace "IT Asset Replacement Item" with your actual child DocType name
// if it is different.
// =====================================

frappe.ui.form.on("IT Asset Repair Replace Item", {
	replaced_component_cost(frm, cdt, cdn) {
		calculate_total_component_replace_cost(frm);
	}
});


// =====================================
// PARENT TABLE FIELD EVENTS
// These trigger when rows are added/removed
// =====================================

frappe.ui.form.on("IT Asset Repair", {
	asset_repair_item_details_add(frm, cdt, cdn) {
		calculate_total_component_repair_cost(frm);
	},

	asset_repair_item_details_remove(frm, cdt, cdn) {
		calculate_total_component_repair_cost(frm);
	},

	asset_replacement_item_details_add(frm, cdt, cdn) {
		calculate_total_component_replace_cost(frm);
	},

	asset_replacement_item_details_remove(frm, cdt, cdn) {
		calculate_total_component_replace_cost(frm);
	}
});


// =====================================
// TOTAL COMPONENT REPAIR COST
// =====================================

function calculate_total_component_repair_cost(frm) {
	let total = 0;

	(frm.doc.asset_repair_item_details || []).forEach(row => {
		total += flt(row.component_repair_cost);
	});

	frm.set_value("total_repair_cost", total);
}


// =====================================
// TOTAL COMPONENT REPLACE COST
// =====================================

function calculate_total_component_replace_cost(frm) {
	let total = 0;

	(frm.doc.asset_replacement_item_details || []).forEach(row => {
		total += flt(row.replaced_component_cost);
	});

	frm.set_value("total_replacement_cost", total);
}