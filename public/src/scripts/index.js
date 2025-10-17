const API_BASE = "https://to-do-project-backend-6zxz.onrender.com";

const DEBUG = false; // true during dev, false for clean console

function refreshHeader() {
  try {
    const loggedIn = !!$.cookie("userid");
    if (DEBUG) console.log("[refreshHeader] loggedIn:", loggedIn, "userid:", $.cookie("userid"));
    // ... rest unchanged ...
  } catch (e) {
    console.warn("refreshHeader error:", e);
  }
}

// small helper: toggle only if element exists within navbar (or globally)
function navToggle(idSelector, show) {
  const $nav = $("#mainNav");
  if ($nav.length) {
    const $el = $nav.find(idSelector);
    if ($el.length) $el.toggle(!!show);
  } else {
    const $g = $(idSelector);
    if ($g.length) $g.toggle(!!show);
  }
}

function refreshHeader() {
  try {
    const loggedIn = !!$.cookie("userid");
    console.log("[refreshHeader] loggedIn:", loggedIn, "userid:", $.cookie("userid"));

    // toggle navbar controls (scoped)
    navToggle("#btnSignin", !loggedIn);
    navToggle("#btnNewUser", !loggedIn);

    navToggle("#btnSignout", loggedIn);
    navToggle("#btnNewAppointment", loggedIn);

    // update label
    const $nav = $("#mainNav");
    if ($nav.length) {
      const $lbl = $nav.find("#lblUser");
      if ($lbl.length) $lbl.text(loggedIn ? $.cookie("userid") : "");
    } else {
      if ($("#lblUser").length) $("#lblUser").text(loggedIn ? $.cookie("userid") : "");
    }
  } catch (e) {
    console.warn("refreshHeader error:", e);
  }
}

// Load a page and update header after injection
function LoadPage(page_name) {
  return $.ajax({
    method: "get",
    url: `./pages/${page_name}`,
    success: (response) => {
      $("section").html(response);
      try { refreshHeader(); } catch (e) { console.warn(e); }
    },
    error: () => alert("Failed to load page: " + page_name),
  });
}

function LoadDashboard() {
  const userid = $.cookie("userid");
  if (!userid) { LoadPage("home.html"); return; }

  $.ajax({
    method: "get",
    url: `./pages/user_dashboard.html`,
    success: (response) => {
      $("section").html(response);
      if ($("#lblUser").length) $("#lblUser").html(userid);
      try { refreshHeader(); } catch(e) {}

      // fetch appointments
      $.ajax({
        method: "get",
        url: `${API_BASE}/appointments/user/${encodeURIComponent(userid)}`,
        success: (appointments) => {
          $("#appointments").empty();
          (appointments || []).forEach((appointment) => {
            // Use MongoDB _id as primary identifier (string)
            const docId = appointment._id ? appointment._id : (appointment._id && appointment._id.$oid ? appointment._id.$oid : null);

            // format date (only yyyy-mm-dd)
            let dateStr = "";
            if (appointment.date) {
              try {
                const d = new Date(appointment.date);
                dateStr = d.toISOString().slice(0, 10);
              } catch (e) {
                dateStr = appointment.date ? String(appointment.date).slice(0, 10) : "";
              }
            }

            const $card = $(`
              <div class="alert alert-success alert-dismissible mb-3">
                <h4>${appointment.title || ""}</h4>
                <p>${appointment.description || ""}</p>
                <div class="mb-2">Date: ${dateStr}</div>
                <div class="mt-3">
                  <button class="btn-edit btn btn-warning me-2" data-id="${docId}">Edit</button>
                  <button class="btn-delete btn btn-danger" data-id="${docId}">Delete</button>
                </div>
              </div>
            `);
            $("#appointments").append($card);
          });
          try { refreshHeader(); } catch(e) {}
        },
        error: (xhr, st, err) => {
          console.error("Failed to fetch appointments", st, err, xhr && xhr.responseText);
          alert("Failed to fetch appointments");
        },
      });
    },
    error: () => alert("Failed to load dashboard page (check path)."),
  });
}

$(function () {
  // initial load then header
  LoadPage("home.html").always(() => { try { refreshHeader(); } catch(e) {} });

  // navigation
  $(document).on("click", "#btnNewUser", () => LoadPage("new_user.html"));
  $(document).on("click", "#btnSignin", () => LoadPage("user_login.html"));
  $(document).on("click", "#btnExistingUser", () => LoadPage("user_login.html"));

  // Register
  $(document).on("click", "#btnRegister", () => {
    const user = {
      user_id: $("#user_id").val(),
      user_name: $("#user_name").val(),
      password: $("#password").val(),
      mobile: $("#mobile").val(),
    };
    $.ajax({
      method: "post",
      url: `${API_BASE}/register-user`,
      data: user,
      success: () => { alert("User Registered"); LoadPage("user_login.html"); },
      error: (xhr, st, err) => { console.error("Register failed:", st, err, xhr && xhr.responseText); alert("Registration failed"); }
    });
  });

  // Login
  $(document).on("click", "#btnLogin", () => {
    const user_id = $("#user_id").val();
    $.ajax({
      method: "get",
      url: `${API_BASE}/users/${encodeURIComponent(user_id)}`,
      success: (userDetails) => {
        if (userDetails) {
          if ($("#password").val() === userDetails.password) {
            $.cookie("userid", user_id);
            try { refreshHeader(); } catch(e) {}
            LoadDashboard();
          } else alert("Invalid Password");
        } else alert("User Not Found");
      },
      error: (xhr, st, err) => { console.error("Login failed:", st, err, xhr && xhr.responseText); alert("Login failed"); }
    });
  });

  // Signout
  $(document).on("click", "#btnSignout", () => {
    $.removeCookie("userid");
    try { refreshHeader(); } catch(e) {}
    LoadPage("home.html");
  });

  // New Appointment
  $(document).on("click", "#btnNewAppointment", () => LoadPage("add_appointment.html"));
  $(document).on("click", "#btnCancel", () => LoadPage("user_dashboard.html"));

  // Add appointment
  $(document).on("click", "#btnAdd", () => {
    // appointment_id optional: if blank, server will set Date.now()
    const appointment = {
      appointment_id: $("#appointment_id").val(),
      title: $("#title").val(),
      description: $("#description").val(),
      date: $("#date").val(),
      user_id: $.cookie("userid"),
    };
    $.ajax({
      method: "post",
      url: `${API_BASE}/add-appointment`,
      data: appointment,
      success: (resp) => {
        console.log("Add response:", resp);
        alert("Appointment Added");
        LoadDashboard();
      },
      error: (xhr, st, err) => { console.error("Failed to add appointment:", st, err, xhr && xhr.responseText); alert("Failed to add appointment"); }
    });
  });

  // Edit - open edit page and load the appointment
  $(document).on("click", ".btn-edit", function () {
    const id = $(this).attr("data-id");
    if (!id) { alert("Edit failed: no id"); return; }
    LoadPage("edit_appointment.html");
    setTimeout(() => {
      $.ajax({
        method: "get",
        url: `${API_BASE}/appointment/${encodeURIComponent(id)}`,
        success: (appointment) => {
          $("#appointment_id").val(appointment.appointment_id || "");
          $("#title").val(appointment.title || "");
          $("#description").val(appointment.description || "");
          try { $("#date").val(new Date(appointment.date).toISOString().slice(0,10)); } catch(e) { $("#date").val(""); }
          // store document _id for save
          sessionStorage.setItem("document_id", appointment._id || id);
        },
        error: () => alert("Failed to load appointment"),
      });
    }, 120);
  });

  $(document).on("click", "#btnEditCancel", () => LoadDashboard());

  // Save edited appointment
  $(document).on("click", "#btnSave", () => {
    const appointment = {
      appointment_id: $("#appointment_id").val(),
      title: $("#title").val(),
      description: $("#description").val(),
      date: $("#date").val(),
      user_id: $.cookie("userid"),
    };
    const id = sessionStorage.getItem("document_id");
    if (!id) { alert("No appointment selected to save"); return; }
    $.ajax({
      method: "put",
      url: `${API_BASE}/edit-appointment/${encodeURIComponent(id)}`,
      data: appointment,
      success: () => { alert("Appointment Updated Successfully"); LoadDashboard(); },
      error: (xhr, st, err) => { console.error("Failed to update appointment:", st, err, xhr && xhr.responseText); alert("Failed to update appointment"); }
    });
  });

  // Delete
  $(document).on("click", ".btn-delete", function () {
    const id = $(this).attr("data-id");
    if (!id) { alert("Delete failed: no id"); return; }
    if (!confirm("Are you sure you want to delete?")) return;
    console.log("Client: sending DELETE ->", `${API_BASE}/delete-appointment/${id}`);
    $.ajax({
      method: "delete",
      url: `${API_BASE}/delete-appointment/${encodeURIComponent(id)}`,
      success: () => { alert("Appointment Deleted"); LoadDashboard(); },
      error: (xhr, st, err) => {
        console.error("❌ Delete failed:", status, err, xhr && xhr.responseText);
        alert("Failed to delete appointment. See console/network for details.");
      }
    });
  });

}); // end ready


