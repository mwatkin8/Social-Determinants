async function loadPatient(){
    if (sessionStorage.getItem("patient") === null) {
        //URL parameters received from the authorization server
        let state = getUrlParameter("state");  // session key
        let code = getUrlParameter("code"); // authorization code
        //Load the previously saved params
        let params = JSON.parse(sessionStorage[state]);
        let token = params.token;
        let client = params.client;
        let secret = params.secret;
        let redirect = params.redirect;
        // Exchange token
        let r = await fetch(token, {
            method:'POST',
            body: 'grant_type=authorization_code&client_id=' + client + '&redirect_uri=' + redirect + '&code=' + code,
            headers: {
    		    'Content-Type': 'application/x-www-form-urlencoded'
    	    }
        });
        let res = await r.json();
        sessionStorage['server'] = params.server;
        sessionStorage['token'] = res.access_token;
        sessionStorage['patient'] = res.patient;
        setDemographics();
        checkHistory();
    }
    else{
        setDemographics();
        checkHistory();
    }
}

// Convenience function for parsing of URL parameters
// based on http://www.jquerybyexample.net/2012/06/get-url-parameters-using-jquery.html
function getUrlParameter(sParam) {
    let sPageURL = window.location.search.substring(1);
    let sURLVariables = sPageURL.split('&');
    for (let i = 0; i < sURLVariables.length; i++)
    {
        let sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            let res = sParameterName[1].replace(/\+/g, '%20');
            return decodeURIComponent(res);
        }
    }
}

async function getResource(url){
    let request = new Request(url, {
        method: 'get',
        headers: {'Authorization': 'Bearer ' + sessionStorage['token']}
    });
    let response = await fetch(request);
    return await response.json();
}

async function setDemographics(){
    let url = sessionStorage['server'] + '/Patient/' + sessionStorage['patient'];
    let patient = await getResource(url);
    document.getElementById('fname').innerText = patient.name[0].given[0];
    document.getElementById('lname').innerText = patient.name[0].family;
    document.getElementById('gender').innerText = patient.gender;
    let today = new Date();
    let age = today.getFullYear() - parseInt(patient.birthDate.split('-')[0]);
    document.getElementById('birthdate').innerText = patient.birthDate;
    document.getElementById('age').innerText = age + ' year(s) old';
    if(patient.telecom){
        for (let i = 0; i < patient.telecom.length; i++) {
            if (patient.telecom[i].system === 'email'){
                document.getElementById('email').innerText = patient.telecom[i].value;
            }
            if (patient.telecom[i].system === 'phone'){
                document.getElementById('phone').innerText = patient.telecom[i].value;
            }
        }
    };
    if(patient.address){
        for (let i = 0; i < patient.address.length; i++) {
            let address = patient.address[i].line[0] + ' ' +
                patient.address[i].city + ' ' +
                patient.address[i].state + ' ' +
                patient.address[i].postalCode + ' ' +
                patient.address[i].country;
            document.getElementById('address').innerText = address
            document.getElementById('map').innerHTML = "<iframe width=\"90%\" height=\"90%\" frameborder=\"0\" style=\"border:0\" src=\"https://www.google.com/maps/embed/v1/place?q=" +
            encodeURI(address) + "&key=AIzaSyCemb2iWu-QyLXTjxgTRIYhmjnnFLYOvf8\" allowfullscreen></iframe>";
        }
    };
}

async function checkHistory(){
    //Pull the PRAPARE questionnaire to get its ID
    let url = sessionStorage['server'] + '/Questionnaire?name=PRAPARE-Questionnaire';
    let request = new Request(url, {
        method: 'get',
        headers: {'Authorization': 'Bearer ' + sessionStorage['token']}
    });
    let response = await fetch(request);
    let bundle = await response.json();
    let id = bundle.entry[0].resource.id;
    //Use the PRAPARE questionnaire ID to get the responses (if any) for this patient
    url = sessionStorage['server'] + '/QuestionnaireResponse?subject=' + sessionStorage['patient'] + '&questionnaire=' + id;
    request = new Request(url, {
        method: 'get',
        headers: {'Authorization': 'Bearer ' + sessionStorage['token']}
    });
    response = await fetch(request);
    bundle = await response.json();
    let history_response = "<dl class=\"row mb-0\"><div class=\"h6 mb-0 mr-2 font-weight-bold text-gray-800\"></div>";
    if (bundle.total === 0){
        document.getElementById('history').innerHTML = history_response + "No responses found for this patient." + "</dl>";
    }
    else{
        bundle.entry.forEach( entry => {
            let r = entry.resource;
            let authored = new Date(r.meta.lastUpdated);
            document.getElementById('history').innerHTML = history_response + "PRAPARE last updated on - &nbsp;<i> " + authored.toString() + "</i></dl>";
            parsePRAPAREResponse(r);
        });
    }
}

async function parsePRAPAREResponse(r){
    console.log(r);

    //Parse personal characteristics
    //address
    let address = r.item[1].item[3].answer[0].valueString;
    document.getElementById('address').innerText = address
    document.getElementById('map').innerHTML = "<iframe width=\"90%\" height=\"90%\" frameborder=\"0\" style=\"border:0\" src=\"https://www.google.com/maps/embed/v1/place?q=" +
    encodeURI(address) + "&key=AIzaSyCemb2iWu-QyLXTjxgTRIYhmjnnFLYOvf8\" allowfullscreen></iframe>";
    //preferred language
    document.getElementById('language').innerText = r.item[0].item[4].answer[0].valueCoding.display;
    //race
    document.getElementById('race').innerText = r.item[0].item[1].answer[0].valueCoding.display;

    let a;
    //Living situation
    //Are you a refugee?
    if(r.item[4].item[1].answer[0].valueCoding.display === "Yes"){
        a = "I am a refugee."
        document.getElementById('living').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    }
    //What is your housing status?
    a = r.item[1].item[1].answer[0].valueCoding.display;
    document.getElementById('living').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    //How many people living at this address?
    a = r.item[1].item[0].answer[0].valueQuantity.value + " people are living at this address";
    document.getElementById('living').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    //Are you worried about losing your housing?
    if(r.item[1].item[2].answer[0].valueCoding.display === "Yes"){
        a = "I am worried about losing this housing."
        document.getElementById('living').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    }
    //Lack of transportation?
    let l = '';
    r.item[2].item[5].answer.forEach(item => {
        l += '<li>' + item.valueCoding.display + '</li>';
    });
    document.getElementById('living').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">Lack of transportation? <ul>" + l + "</ul></li>"

    //Finances
    //Emplayment status
    a = 'Employment status: ' + r.item[2].item[1].answer[0].valueCoding.display;
    document.getElementById('finances').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    //Household income
    a = 'Estimated household income: ' + r.item[2].item[3].answer[0].valueQuantity.value;
    document.getElementById('finances').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    //Primary insurance
    a = 'Primary insurance: ' + r.item[2].item[2].answer[0].valueCoding.display;
    document.getElementById('finances').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    //Unable to get the following items when needed
    l = '';
    r.item[2].item[4].answer.forEach(item => {
        l += '<li>' + item.valueCoding.display + '</li>';
    });
    document.getElementById('finances').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">Unable to get the following when needed: <ul>" + l + "</ul></li>"
    //Farm work is main source of income
    if(r.item[0].item[2].answer[0].valueCoding.display === "Yes"){
        a = "Season or migrant farm work has been a main source of income within the past 2 years."
        document.getElementById('finances').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    }

    //Social and Emotional
    document.getElementById('social_emotional').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">I see or talk to people I feel close to and care about:<ul><li>" + r.item[3].item[0].answer[0].valueCoding.display; + "</li></ul></li>"
    document.getElementById('social_emotional').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">How stressed I feel:<ul><li>" + r.item[3].item[1].answer[0].valueCoding.display; + "</li></ul></li>"
    if(r.item[4].item[0].answer[0].valueCoding.display === "Yes"){
        a = "I spent more than 2 nights in a row in a jail, prison, detention center, or juvenile correctional facility."
        document.getElementById('social_emotional').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    }
    document.getElementById('social_emotional').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">Highest level of education:<ul><li>" + r.item[2].item[0].answer[0].valueCoding.display; + "</li></ul></li>"
    if(r.item[0].item[3].answer[0].valueCoding.display === "Yes"){
        a = "I have been discharged from the armed forces of the United States."
        document.getElementById('social_emotional').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    }

    //Safety
    if(r.item[4].item[2].answer[0].valueCoding.display === "No"){
        a = "I do NOT feel physically and emotionally safe where I currently live."
    }
    else{
        a = "I feel physically and emotionally safe where I currently live."
    }
    document.getElementById('safety').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    if(r.item[4].item[3].answer[0].valueCoding.display === "Yes"){
        a = "Within the last year, I have been afraid of my partner or ex-partner."
        document.getElementById('safety').innerHTML += "<li class=\"h6 mb-0 text-gray-800\">" + a + "</li>"
    }
}
