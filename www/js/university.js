
(function() {
    // send a AJAX request to the server
    $.ajax({
        method: "GET",
        url: "/v2/api/zipcodes"
    })
    .done(function(msg) {
        let json = JSON.parse(msg);
        let container = $("#unizip");
        for(let i = 0; i < json.length; i++) {
            let item = json[i];
            container.append(`<option value="${item.zipcode}">${item.zipcode} | ${item.city}, ${item.us_state}</option>`);
        }
    })
    .fail(function(req, status) {
        console.error({ err: status });
    });

    const form = document.getElementById("uniform");
    const unizip = document.getElementById("unizip");
    const zipcity = document.getElementById("zipcity");
    const zipstate = document.getElementById("zipstate");
    const zipcode = document.getElementById("zipcode");
    const unid = document.getElementById("unid");

    // minimal validation
    form.addEventListener("submit", function(ev) {
        let value = unizip.options[unizip.selectedIndex].value;
        if(value === 'null') {
            if(zipcity.value === '' || zipstate === '' || zipcode === '')
                return ev.preventDefault();
        } else if(value === undefined) {
            return ev.preventDefault();
        }

        return;
    });
})();
