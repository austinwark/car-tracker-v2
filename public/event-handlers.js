$(document).ready(() => {
  /* Bottom Nav Home button in mobile view */
  $("#mobile-home-button").on("click", (event) => {
    $(".panel").removeClass("panel-active");
    $("#side-panel").addClass("panel-active");
    $("#mobile-bottom-nav button").removeClass("nav-active");
    $(event.currentTarget).addClass("nav-active");
  });

  /* Bottom Nav Results button in mobile view */
  $("#mobile-results-button").on("click", (event) => {
    $(".panel").removeClass("panel-active");
    $("#results-panel").addClass("panel-active");
    $("#mobile-bottom-nav button").removeClass("nav-active");
    $(event.currentTarget).addClass("nav-active");
  });

  /* Bottom Nav Settings button in mobile view */
  $("#mobile-bottom-nav #mobile-settings-button").on("click", (event) => {
    $(".panel").removeClass("panel-active");
    $("#meta-panel").addClass("panel-active");
    $("#mobile-bottom-nav button").removeClass("nav-active");
    $(event.currentTarget).addClass("nav-active");
  });

  /* Focuses first input in create new query form */
  $("#create-offcanvas-button").on("click", () => {
    $("input[name=query-name]").focus();
  });

  /* Send email confirmation on button click */
  $("#email-verified").on("click", () => {
    $.ajax({
      type: "GET",
      url: "api/users/resend-verification",
      success: () => {
        showToast("Success!", "Email verification link sent.");
      },
      error: () => {
        showToast("Oops!", "Error sending verification link.");
      },
    });
  });

  /*  Send results to email button click handler */
  $("#email-results-button").on("click", () => {
    const $emailLoader = $("#email-loader");
    $emailLoader.show();
    const queryId = $(".query-list-item.query-selected").data("id");
    getQueryResults(queryId).then((queryResults) => {
      const resultsData = convertResultsToJson(queryResults.results);
      const obj = { results: resultsData };
      $.ajax({
        type: "POST",
        url: "api/results/email",
        data: { results: queryResults.results },
        content: "application/json;charset=UTF-8",
        success: () => {
          $emailLoader.hide();
          showToast("Success!", "Results sent to your email address.");
        },
        error: (err) => {
          console.log(err);
          $emailLoader.hide();
          showToast(
            "Oops!",
            "An error was encountered when sending results to your email address."
          );
        }
      });
    });
  });

  /* Fetches and displays query name in delete confirmation modal */
  $("#settings-delete-button").on("click", () => {
    const selectedQueryId = $(".queries-list")
      .find("li.query-selected")
      .data("id");
    getSingleQuery(selectedQueryId).then((query) => {
      const $modalBodyText = $("#delete-confirmation-modal .modal-body span");
      $modalBodyText.text("").append(` #${query.name}?`);
    });
  });

  /* Query delete modal -- confirmation button click handler */
  $("#query-delete-confirmation-button").on("click", () => {
    const selectedQueryId = $(".queries-list")
      .find("li.query-selected")
      .data("id");
    deleteSingleQuery(selectedQueryId).then(() => {
      $("#delete-confirmation-modal").modal("hide");
      // $("body").removeClass("modal-open").removeProp("style");
      showToast("Success!", "Query deleted successfully!");
      refreshQueriesAndResults();
    });
  });

  /* New query form submit handler */
  $("#create-form").submit((event) => {
    $("#submit-icon").hide();
    $("#submit-loader").show();
    // Convert form data to cleaned up POJO
    const formData = convertFormToJson($("#create-form"));
    $.ajax({
      type: "POST",
      url: "api/queries/submit",
      data: JSON.stringify(formData),
      contentType: "application/json;charset=UTF-8",
      success: function (data) {
        let { queryId } = data;
        $("#submit-icon").show();
        $("#submit-loader").hide();
        clearFormData();
        refreshQueriesAndResults(queryId);
        $(".offcanvas").removeClass("show");
        showToast("Success!", "Query created successfully!");
      },
      error: function (request, status, error) {
        console.error(error);
      },
    });
    event.preventDefault();
  });

  /* Results refresh button click handler */
  $("#results-refresh-button").on("click", () => {
    const activeQueryId = $(".query-list-item.query-selected").data("id");
    $("#refresh-icon").hide();
    $("#refresh-loader").show();
    $.ajax({
      type: "GET",
      url: `api/results/refresh/${activeQueryId}`,
      success: (response) => {
        $("#refresh-icon").show();
        $("#refresh-loader").hide();
        showToast("Success!", "Results refreshed successfully!");
        refreshQueriesAndResults(activeQueryId);
      },
    });
  });

  /* Opens result details modal */
  $("#result-details-modal").on("show.bs.modal", (event) => {
    const $button = $(event.relatedTarget);
    const queryId = $button.data("query-id");
    const activeVin = $button.data("vin");
    const $carouselInner = $("#result-details-carousel .carousel-inner");
    $carouselInner.children().remove(); // clear modal
    getQueryResults(queryId).then((results) => {
      const slideArray = displayCarouselSlides(results.results, activeVin);
      for (let i = 0; i < slideArray.length; i++) {
        $carouselInner.append(slideArray[i]);
      }
    });
  });

  /* Change password modal submit button click handler */
  $("#form-submit-button").on("click", () => {
    $(".alert").hide(); // Hide any shown alerts
    const formData = convertFormToJson($("#change-password-form"));
    const { password, confirmPassword } = formData;
    if (password.length == 0 || confirmPassword.length == 0) {
      $(".alert-danger").html("All fields are required.").show();
      return;
    } else if (password !== confirmPassword) {
      $(".alert-danger").html("Passwords must match.").show();
      return;
    }
    $("#change-password-form").submit();
  });

  /* Price/Year sort button click handler */
  $(".sort-button").on("click", function() {
    const desc = $(this).data("desc");
    const asc = $(this).data("asc");
    const sortBy = $(this).data("sort-by");
    const $clickedSortButton = $(this);
    const $otherSortButton = $(`.sort-button[data-sort-by!=${sortBy}]`);
    let newOrder;
    if (!desc && !asc) {
      newOrder = $clickedSortButton.hasClass("desc") ? "desc" : "asc";
    } else {
      newOrder = desc ? "asc" : "desc";
    }
    $clickedSortButton.removeClass("asc desc active").addClass(`${newOrder} active`).data(
      { "desc": newOrder === "desc",
      "asc" : newOrder === "asc" });
    $otherSortButton.removeClass("active").data({ "desc": false, "asc": false });
    sortResults(sortBy, newOrder);
  });

});
