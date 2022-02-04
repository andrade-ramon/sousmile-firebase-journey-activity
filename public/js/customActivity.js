define([
    'postmonger'
], function (
    Postmonger
) {
  'use strict';

  var connection = new Postmonger.Session();
  var authTokens = {};
  var payload = {};
  var lastStepEnabled = false;
  var eventDefinitionKey;
  var firebasePushTemplateMessages = [];
  var isSearching = false;
  var schema = [];

  var steps = [ // initialize to the same value as what's set in config.json for consistency
    { "label": "Escolha a mensagem", "key": "step1" },
    { "label": "Valide as DEs", "key": "step2" }    
  ];
  var currentStep = steps[0].key;

  $(window).ready(onRender);

  connection.on('initActivity', initialize);
  connection.on('requestedTokens', onGetTokens);
  connection.on('requestedEndpoints', onGetEndpoints);
  connection.on('clickedNext', onClickedNext);
  connection.on('clickedBack', onClickedBack);
  connection.on('gotoStep', onGotoStep);
  connection.on('requestedInteraction', onRequestedInteraction);
  connection.on('requestedSchema', onRequestedSchema);


  function onRender() {    
    connection.trigger('ready');
    connection.trigger('requestTokens');
    connection.trigger('requestEndpoints');
    connection.trigger('requestInteraction');
    connection.trigger('requestSchema');
    loadFirebaseMessages();
    // initialize();
  } 

  function displayLoader() {
    isSearching = true;
    $('.loading').show();
    $(".box").hide();
  }

  function hideLoader() {
    isSearching = false;
    $('.loading').hide();
    $(".box").show();
  }

  function resetProperties() {
    $("#select1").html("<option value=''>Selecione</option>");
    firebasePushTemplateMessages = [];
    $("#total").html("buscando...");
    $("#attrib").html("");
    $('#name-step-3').html("");
    $('#title-step-3').html("");
    $('#message-step-3').html("");
    $('#error').hide();
    $('#message').html("");
  }

  function loadFirebaseMessages() {
    displayLoader();
    resetProperties();
    
    var searchText = $('#search-text').val();
    var url = "https://firebase-app-integration.herokuapp.com/push-templates"
    // var url = "http://localhost:3300/push-templates"
    
    
    if (searchText && searchText != '') {
      url = url + '?search_text=' + searchText;
    }

    $.ajax({
      type: "GET",
      url: url,
      success: function(data){
        firebasePushTemplateMessages = data;

        data.forEach(item => {
          $("#select1").append(new Option(item.name, item.name));
        });

        if(data.length == 1) { //select first message
          $("#select1").val(data[0].name);
          selectedMessageChanged();
        }
        
        $("#total").html(data.length);
        hideLoader();
      }
    });
  }

  function hasAllMessageParameters() {
    var message = getSelectedMessage();
    var messageFields = message.fields;
    var totalFoundFields = 0;
    var customerFields = ['email','full_name','first_name','phone_number','desired_treatment','whatsapp_optin'];
    var storeFields = ['id', 'short_name'];
    
    schema.forEach(item => {
      var key = item.key.split('.')[2];
      if (messageFields.includes(key)) {
        $('.attrib_' + key).addClass('success');
        totalFoundFields++;
      }
    });

    customerFields.forEach(item => {
      if (messageFields.includes(item)) {
        $('.attrib_' + item).addClass('success');
        totalFoundFields++;
      }
    });
    
    storeFields.forEach(item => {
      if (messageFields.includes(item)) {
        $('.attrib_' + item).addClass('success');
        totalFoundFields++;
      }
    });

    if (totalFoundFields < messageFields.length) {
      $('#error').show();
    }

    return totalFoundFields >= messageFields.length;
  }
  
  function selectedMessageChanged() {
    var selectedMessage = getSelectedMessage();
    connection.trigger('updateButton', { button: 'next', enabled: Boolean(selectedMessage.name) });

    $('#message').html(selectedMessage.message);
    $('#push_template_name').html(selectedMessage.name);
    $('#push_title').html(selectedMessage.title);
    $('#message-step-3').html(selectedMessage.message);
    $('#attrib').html("");
    selectedMessage.fields.forEach(field => {
      $('#attrib').append("<span class='attrib attrib_" + field + "' >" + field + "</span>")
    });

    hasAllMessageParameters();
  }

  function initialize(data) {
    $('#search-text').on('keypress',function(e) {
      if(isSearching) {
        return;
      }
      if(e.which == 13) {
        loadFirebaseMessages();
      }
    });

    
    $('#select1').change(function() {
      selectedMessageChanged();
    });

    if (data) {
      payload = data;
    }
    
    var message;
    var hasInArguments = Boolean(
      payload['arguments'] &&
      payload['arguments'].execute &&
      payload['arguments'].execute.inArguments &&
      payload['arguments'].execute.inArguments.length > 0
    );

    var inArguments = hasInArguments ? payload['arguments'].execute.inArguments : {};
    
    console.log('inArguments=======')
    console.log(inArguments);

    $.each(inArguments, function(index, inArgument) {
      $.each(inArgument, function(key, val) {
        if (key === 'message') {
          message = val;
        }
      });
    });

    // If there is no message selected, disable the next button
    if (!message) {
      showStep(null, 1);
      connection.trigger('updateButton', { button: 'next', enabled: false });
      // If there is a message, skip to the summary step
    } else {
      $('#select1').find('option[value='+ message +']').attr('selected', 'selected');
      $('#message').html(message);      
    }
  }

  function onGetTokens(tokens) {
    console.log("tokens=========");
    console.log(tokens);
    authTokens = tokens;
  }

  function onGetEndpoints(endpoints) {
    console.log('endpoint=========');
    console.log(endpoints);
  }

  function onClickedNext () {
    if (currentStep.key === 'step2') {
      save();
    } else {
      connection.trigger('nextStep');
    }
  }

  function onClickedBack () {
    connection.trigger('prevStep');
  }

  function onGotoStep(step) {
    showStep(step);
    connection.trigger('ready');
  }

  function showStep(step, stepIndex) {
    if (stepIndex && !step) {
      step = steps[stepIndex-1];
    }

    currentStep = step;
    $('.step').hide();

    switch(currentStep.key) {
      case 'step1':
        $('#step1').show();
        connection.trigger('updateButton', {
          button: 'next',
          enabled: Boolean(getSelectedMessageName())
        });
        connection.trigger('updateButton', {
          button: 'back',
          visible: false
        });
        break;

      case 'step2':
        $('#step2').show();
        connection.trigger('updateButton', {
          button: 'back',
          visible: true
        });
        connection.trigger('updateButton', {
          button: 'next',
          text: 'done',
          visible: true,
          enabled: Boolean(hasAllMessageParameters())
        });
        break;
    }

  }

  function save() {
    var message = getSelectedMessage();

    payload['arguments'].execute.inArguments = [{ 
      "push_message_template_id": message.id,
      "message": message.message,
      "email": "{{Contact.Attribute.customers.email}}",
      "name": "{{Contact.Attribute.customers.full_name}}",
      "first_name": "{{Contact.Attribute.customers.first_name}}",
      "phone_number":  "{{Contact.Attribute.customers.phone_number}}",
      "treatment_type":  "{{Contact.Attribute.customers.desired_treatment}}",
      "whatsapp_optin":  "{{Contact.Attribute.customers.whatsapp_optin}}",
      "store_id": "{{Contact.Attribute.stores.id}}",
      "store_name": "{{Contact.Attribute.stores.short_name}}",
      "firebase_token": "{{Contact.Attribute.customer_app_infos.firebase_token}}"
    }];

    var a = []
    if (message.fields) {      
      message.fields.forEach(field => {
        if (!payload['arguments'].execute.inArguments[0][field]) {
          payload['arguments'].execute.inArguments[0][field] = "{{Event." + eventDefinitionKey + "." + field + "}}"
          a[field] = "{{Event." + eventDefinitionKey + "." + field + "}}";
        }
      });
    }

    payload['metaData'].isConfigured = true;
    payload['name'] = message.name;

    connection.trigger('updateActivity', payload);
  }

  function onRequestedInteraction(settings) {
    console.log(settings);
    eventDefinitionKey = settings.triggers[0].metaData.eventDefinitionKey;
  }

  function onRequestedSchema(data) {
    schema = data['schema'];
    
    schema.forEach(item => {
      console.log(item)
      $("#attribute-list").append('<li>' + item.key.split('.')[2] + '</li>');
    });
  }

  function getSelectedMessageName() {
    return $('#select1').find('option:selected').attr('value').trim();
  }

  function getSelectedMessage() {
    var selectedMessageName = getSelectedMessageName();

    var foundMessage = {};
    firebasePushTemplateMessages.forEach(item => {
      if (item.name == selectedMessageName) {
        foundMessage = item
      }
    })

    return foundMessage;
  }

});