// Copyright (c) 2026, Precihole Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("IT Asset Repair", {

	refresh(frm) {

		// =====================================
		// TOTAL COMPONENT REPAIR COST
		// =====================================

		calculate_total_component_repair_cost(frm);



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

							// YES

							frm.set_value(
								"status",
								"Completed"
							);

							frm.save();

						},

						function () {

							// NO

							frappe.show_alert({
								message: __("Action Cancelled"),
								indicator: "orange"
							});
						}
					);
				}
			).addClass("btn-success");
		}
	}
});



// =====================================
// CHILD TABLE EVENTS
// =====================================

frappe.ui.form.on("IT Asset Repair Item", {

	// =====================================
	// COMPONENT REPAIR COST
	// =====================================

	component_repair_cost(frm, cdt, cdn) {

		calculate_total_component_repair_cost(frm);

	},



	// =====================================
	// COMPONENT CONDITION AFTER REPAIR
	// =====================================

	component_condition_after_repair(frm, cdt, cdn) {

		let row = locals[cdt][cdn];

		// Scrap selected
		if (row.component_condition_after_repair === "Scrap") {

			frappe.model.set_value(
				cdt,
				cdn,
				"component_condition",
				"Decommissioned"
			);

		}

		// Other option selected
		else {

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
// TOTAL COMPONENT REPAIR COST
// =====================================

function calculate_total_component_repair_cost(frm) {

	let total = 0;

	(frm.doc.asset_repair_item_details || []).forEach(row => {

		total += flt(row.component_repair_cost);

	});

	frm.set_value(
		"all_component_repair_cost",
		total
	);
}