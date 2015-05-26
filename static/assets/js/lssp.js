function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

function do_message(title, message, error) {
   $("#callout").show();
   $("#callout").removeClass();
   if (error) {
     $("#callout").addClass("bs-callout bs-callout-danger");
   } else {
     $("#callout").addClass("bs-callout bs-callout-info");
   }
   $("#callout>#title").html(title);
   $("#callout>#message").html(message);
}

function do_reset() {

    userid = $("#reset_box>input[id=userid]")[0].value;

    var request_data = new Object();
    request_data.userid = userid;

    if (userid == "") {
        do_message("Failed to reset password!",
                   "Please inform a valid username or email",
                   true);
        return;
    }

    $.ajax({
        dataType: "json",
        type: "POST",
        contentType: "application/json", //mandatory
        data: JSON.stringify(request_data),
        url: "api/reset/",
        error: function(xhr, ajaxOptions, thrownError) {
            msg = xhr.status + ":" + xhr.statusText + ' ';
            if (xhr.responseJSON) {
              msg += xhr.responseJSON.message;
            } else {
              msg += xhr.responseText;
            }
            do_message("Error!",
                       msg,
                       true);
        },
        success: function(data) {
            msg = data.message;
            msg += " An email was sent to <strong>" + data.email + "</strong>";
            do_message("Well done!", msg);
        }
    });
}

function do_confirm() {
    var password = $("#confirm_box>input[id=password]")[0].value;
    var token = getURLParameter("token");

    var request_data = new Object();
    request_data.token = token;
    request_data.password = password;
    
    if (password == "") {
        do_message("Failed to reset password!",
                   "Please inform a valid password.",
                   true);
        return;
    }

    if (token == null) {
        do_message("Failed to reset password!",
                   "Invalid token, please check your email, and click on reset link.",
                   true);
        return;
    }


    $.ajax({
        dataType: "json",
        type: "POST",
        contentType: "application/json", //mandatory
        data: JSON.stringify(request_data),
        url: "api/confirm/",
        error: function(xhr, ajaxOptions, thrownError) {
            msg = xhr.status + ":" + xhr.statusText + ' ';
            if (xhr.responseJSON) {
              msg += xhr.responseJSON.message;
            } else {
              msg += xhr.responseText;
            }
            do_message("Error!",
                       msg,
                       true);
        },
        success: function(data) {
            do_message("Well done!", "Your password has been updated.");
        }
    });
}
