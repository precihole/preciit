// Copyright (c) 2026, Shubham Mishra and contributors
// For license information, please see license.txt

const REPAIR_STATUSES_REQUIRING_REPLACEMENT = [
	"Damaged",
	"Replaced",
	"Removed",
	"Faulty",
	"Decommissioned"
];

let repair_item_previous_status = {};
let repair_item_status_reverting = {};

frappe.ui.form.on("IT Asset Repair", {
	onload_post_render(frm) {
		remember_repair_item_statuses(frm);
		bind_repair_item_status_memory(frm);
	},

	refresh(frm) {
		// =====================================
		// CALCULATE TOTALS
		// =====================================

		calculate_total_component_repair_cost(frm);
		calculate_total_component_replace_cost(frm);
		remember_repair_item_statuses(frm);
		bind_repair_item_status_memory(frm);

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
		validate_repair_item_issue_descriptions(frm);
	}
});


// =====================================
// CHILD TABLE EVENTS - REPAIR ITEMS
// Child Doctype: IT Asset Repair Item
// Parent Table Fieldname: asset_repair_item_details
// =====================================

frappe.ui.form.on("IT Asset Repair Item", {
	form_render(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		remember_repair_item_status(
			row,
			get_repair_item_status_key(row, cdn)
		);
	},

	status(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		let row_key = get_repair_item_status_key(row, cdn);

		if (repair_item_status_reverting[row_key]) {
			delete repair_item_status_reverting[row_key];
			remember_repair_item_status(row, row_key);
			return;
		}

		if (!requires_replacement_item(row.status)) {
			remove_replacement_item_from_repair_row(frm, row);
			remember_repair_item_status(row, row_key);
			return;
		}

		if (!row.issue_description) {
			let previous_status = get_previous_repair_item_status(
				row,
				row_key
			);
			let dialog = frappe.msgprint(
				__("Issue Description is required in row {0} for Component Type {1} before using status {2}.", [
					get_repair_item_row_label(frm, row, cdn),
					row.component_type || __("Not Set"),
					row.status
				])
			);
			revert_repair_item_status(
				frm,
				cdt,
				cdn,
				row_key,
				previous_status
			);
			keep_repair_item_row_open(frm, cdn, "issue_description");

			if (dialog && dialog.$wrapper) {
				dialog.$wrapper.one("hidden.bs.modal", () => {
					keep_repair_item_row_open(frm, cdn, "issue_description");
				});
			}
			return;
		}

		add_replacement_item_from_repair_row(frm, row);
		remember_repair_item_status(row, row_key);
	},

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
		remember_repair_item_status(locals[cdt][cdn], cdn);

		setTimeout(() => {
			remember_repair_item_status(locals[cdt][cdn], cdn);
		}, 0);
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

// =====================================
// VALIDATE REPAIR ITEM ISSUE DESCRIPTIONS
// =====================================
function validate_repair_item_issue_descriptions(frm) {
	let missing_rows = (frm.doc.asset_repair_item_details || []).filter(row => {
		return requires_replacement_item(row.status) && !row.issue_description;
	});

	if (!missing_rows.length) {
		return;
	}

	let row = missing_rows[0];

	frappe.throw(
		__("Issue Description is required in Asset Repair Item row {0} for Component Type {1} before using status {2}.", [
			row.idx,
			row.component_type || __("Not Set"),
			row.status
		])
	);
}


function requires_replacement_item(status) {
	return REPAIR_STATUSES_REQUIRING_REPLACEMENT.includes(status);
}


function remember_repair_item_statuses(frm) {
	(frm.doc.asset_repair_item_details || []).forEach(row => {
		remember_repair_item_status(
			row,
			get_repair_item_status_key(row, row.name)
		);
	});
}


function remember_repair_item_status(row, row_key) {
	if (!row) {
		return;
	}

	let status = row.status || "";

	if (row_key) {
		repair_item_previous_status[row_key] = status;
	}

	if (row.name) {
		repair_item_previous_status[row.name] = status;
	}

	row.__previous_status = status;
}


function get_repair_item_status_key(row, cdn) {
	return (row && row.name) || cdn;
}


function get_previous_repair_item_status(row, row_key) {
	if (
		row_key &&
		Object.prototype.hasOwnProperty.call(
			repair_item_previous_status,
			row_key
		)
	) {
		return repair_item_previous_status[row_key] || "";
	}

	if (row && row.__previous_status !== undefined) {
		return row.__previous_status || "";
	}

	return "";
}


function revert_repair_item_status(frm, cdt, cdn, row_key, previous_status) {
	repair_item_status_reverting[row_key] = true;

	return frappe.model.set_value(
		cdt,
		cdn,
		"status",
		previous_status || ""
	).then(() => {
		let row = locals[cdt][cdn];

		remember_repair_item_status(row, row_key);
		keep_repair_item_row_open(frm, cdn, "issue_description");
	});
}


function bind_repair_item_status_memory(frm) {
	let grid = frm.fields_dict.asset_repair_item_details
		&& frm.fields_dict.asset_repair_item_details.grid;

	if (!grid || !grid.wrapper) {
		return;
	}

	grid.wrapper
		.off(
			"focusin.repair_item_status_memory",
			'[data-fieldname="status"] input, [data-fieldname="status"] select'
		)
		.on(
			"focusin.repair_item_status_memory",
			'[data-fieldname="status"] input, [data-fieldname="status"] select',
			function () {
				let row_name = $(this).closest(".grid-row").attr("data-name");
				let row = row_name && locals["IT Asset Repair Item"][row_name];

				remember_repair_item_status(
					row,
					get_repair_item_status_key(row, row_name)
				);
			}
		);
}


function keep_repair_item_row_open(frm, cdn, fieldname) {
	setTimeout(() => {
		let grid_row = get_repair_item_grid_row(frm, cdn);

		if (!grid_row) {
			return;
		}

		grid_row.toggle_view(true, () => {
			let field = grid_row.grid_form
				&& grid_row.grid_form.fields_dict
				&& grid_row.grid_form.fields_dict[fieldname];

			if (field && field.set_focus) {
				field.set_focus();
			}
		});
	}, 100);
}


function get_repair_item_grid_row(frm, cdn) {
	let grid = frm.fields_dict.asset_repair_item_details
		&& frm.fields_dict.asset_repair_item_details.grid;

	return grid
		&& grid.grid_rows_by_docname
		&& grid.grid_rows_by_docname[cdn];
}


function get_repair_item_row_label(frm, row, cdn) {
	if (row.idx) {
		return row.idx;
	}

	let rows = frm.doc.asset_repair_item_details || [];
	let row_index = rows.findIndex(item => item.name === cdn);

	return row_index >= 0 ? row_index + 1 : cdn;
}


function add_replacement_item_from_repair_row(frm, repair_row) {
	let device_configuration_row_id = repair_row.device_configuration_row_id;

	if (!device_configuration_row_id) {
		frappe.msgprint(
			__("Device Configuration Row ID is required before adding replacement item for row {0}.", [
				repair_row.idx
			])
		);
		return;
	}

	if (get_existing_replacement_item(frm, device_configuration_row_id)) {
		frappe.show_alert({
			message: __("Replacement item already exists for row {0}", [repair_row.idx]),
			indicator: "orange"
		});
		return;
	}

	add_replacement_item_from_repair(
		frm,
		repair_row,
		device_configuration_row_id
	);
}


function get_existing_replacement_item(frm, device_configuration_row_id) {
	return (frm.doc.asset_replacement_item_details || []).find(row => {
		return row.old_device_configuration_row_id === device_configuration_row_id;
	});
}


function remove_replacement_item_from_repair_row(frm, repair_row) {
	let device_configuration_row_id = repair_row.device_configuration_row_id;

	if (!device_configuration_row_id) {
		return;
	}

	let replacement_row = get_existing_replacement_item(
		frm,
		device_configuration_row_id
	);

	if (!replacement_row) {
		return;
	}

	frappe.model.clear_doc(replacement_row.doctype, replacement_row.name);

	frm.doc.asset_replacement_item_details = (
		frm.doc.asset_replacement_item_details || []
	).filter(row => row.name !== replacement_row.name);

	frm.refresh_field("asset_replacement_item_details");
	calculate_total_component_replace_cost(frm);

	frappe.show_alert({
		message: __("Replacement item removed for row {0}", [repair_row.idx]),
		indicator: "orange"
	});
}


function add_replacement_item_from_repair(frm, repair_row, device_configuration_row_id) {
	let replacement_row = frm.add_child("asset_replacement_item_details");

	replacement_row.component_type = repair_row.component_type;
	replacement_row.component_category = repair_row.component_category;
	replacement_row.status = "Active";
	replacement_row.old_device_configuration_row_id = device_configuration_row_id;

	frm.refresh_field("asset_replacement_item_details");
	calculate_total_component_replace_cost(frm);

	frappe.show_alert({
		message: __("Replacement item added for row {0}", [repair_row.idx]),
		indicator: "green"
	});
}
