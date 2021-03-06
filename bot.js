'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
const config = require('config');
const messages = require('./messages.js');
const audio = require('./audio.js');
const loki = require('lokijs');
const schedule = require('node-schedule');

let db = new loki('users.json');
let users = db.addCollection('users');

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Webhook validation
app.get('/webhook', function(req, res) {
  var verify_token = "";
  try { // running locally
    verify_token  = config.get("VERIFY_TOKEN");
  } catch(err) { // running on heroku
    verify_token = process.env.VERIFY_TOKEN;
  }

  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === verify_token) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

// Display the web page
app.get('/', function(req, res) {
  var messengerButton = "<html><head><title>Ammi Service</title></head><body><h1>Ammi Service</h1>This is a Facebook bot, running on Heroku.</body></html>";
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  var data = req.body;

  if (data.object === 'page') {

    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    res.sendStatus(200);
  }
});

// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;
  var messageQuickReply = message.quick_reply;

  if(messageQuickReply) {
    var payload = messageQuickReply.payload;
    var monthOfConception = payload.split("_")[1];

    if(!isANumber(monthOfConception)) {
      console.error("Irregular payload received from quick reply = %s", payload);
    } else {
      var pregnancyWeek = getPregnancyWeek(monthOfConception);
      var user = users.find({'senderID': senderID});
      if(user.length != 0) {
        if(user[0].pregnancyWeek == undefined) {
          user[0].pregnancyWeek = pregnancyWeek;
          user[0].currWeek = pregnancyWeek;
          users.update(user);
        }
        scheduleTipsStartingAtWeek(senderID, pregnancyWeek);
      }
    }
  } else if(messageText) {
    sendTextMessage(messageText);
  } else if(messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  if(payload === "get_started") {
    if(users.find( {'senderID': senderID} ).length == 0) {
      users.insert({'senderID': senderID});
    }
    sendLanguageMessage(senderID);
  } else if(payload.includes("LANG")) {
    var locale = payload.split(":")[1];
    messages.msgs.setLocale(locale);
    audio.audio.setLocale(locale);
    sendPregnancyStateMessage(senderID);
  } else if(payload.includes("ACTION")) {
    var action = payload.split(":")[1];
    switch(action) {
      case 'OPT-OUT':
        optOut(senderID);
        break;
      default:
        console.error("Recieved an unkown action %s", action);
    }
  } else {
    console.error("Received an unknown postback with payload %s", payload);
  }
}

function sendLanguageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Welcome to Ammi Service! Please select a language option below",
          buttons: [{
            type: "postback",
            title: "English",
            payload: "LANG:en_US"
          }, {
            type: "postback",
            title: "Urdu",
            payload: "LANG:ur_PK"
          }]
        }
      }
    }
  };
  callSendAPI(messageData);
}

function sendPregnancyStateMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messages.msgs.translate("PREGNANCY_STATE"),
      "quick_replies":[{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_2"),
        "payload":"moc_2"
      },{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_3"),
        "payload":"moc_3"
      },{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_4"),
        "payload":"moc_4"
      },{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_5"),
        "payload":"moc_5"
      },{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_6"),
        "payload":"moc_6"
      },{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_7"),
        "payload":"moc_7"
      },{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_8"),
        "payload":"moc_8"
      },{
        "content_type":"text",
        "title":messages.msgs.translate("MOC_9"),
        "payload":"moc_9"
      }]
    }
  };
  callSendAPI(messageData);
}

function isANumber(str){
  return !/\D/.test(str);
}

function getPregnancyWeek(monthOfConception) {
  if(monthOfConception === "2") {
    return "5";
  } else if(monthOfConception === "3") {
    return "9";
  } else if(monthOfConception === "4") {
    return "15";
  } else if(monthOfConception === "5") {
    return "18";
  } else if(monthOfConception === "6") {
    return "22";
  } else if(monthOfConception === "7") {
    return "27";
  } else if(monthOfConception === "8") {
    return "31";
  } else {
    return "36"
  }
}

function scheduleTipsStartingAtWeek(recipientId, pregnancyWeek) {
  var today = new Date();
  var day = today.getDay();
  var hour = today.getHours();
  var minute = today.getMinutes();

  sendTipForWeek(recipientId, pregnancyWeek, 1);
  sendAudioTipForWeek(recipientId, pregnancyWeek, 1);
  if(day > 4) {
    // Today is one of Friday, Saturday or Sunday.
    // We will send only send one tip for this week, but starting next week,
    // 2 tips will be sent each ... one on Tuesday and one on Saturday

    // move to next week
    var user = users.find({'senderID': recipientId});
    user[0].currWeek = user[0].currWeek++;
    users.update(user);
  }

  schedule.scheduleJob({hour: 9, minute: 0, dayOfWeek: 2}, function() {
    var user = users.find({'senderID': recipientId});
    var week = user[0].currWeek;
    sendTipForWeek(recipientId, week, 1);
    sendAudioTipForWeek(recipientId, week, 1);
  }.bind(null, recipientId));

  schedule.scheduleJob({hour: 9, minute: 0, dayOfWeek: 6}, function() {
    var user = users.find({'senderID': recipientId});
    var weak = user[0].currWeek;
    sendTipForWeek(recipientId, week, 2);
    sendAudioTipForWeek(recipientId, week, 2);
    user[0].week++;
    users.update(user);
  }.bind(null, recipientId));
}

function sendTipForWeek(recipientId, week, tipNum) {
  var tip = "";
  try {
    var tip = messages.msgs.translate(week + "-" + tipNum);
  } catch (err) {
    console.log("Week %s is missing tip number %s", week, tipNum);
    return;
  }
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: tip,
          buttons: [{
            type: "postback",
            title: messages.msgs.translate("OPT-OUT"),
            payload: "ACTION:OPT-OUT"
          }]
        }
      }
    }
  };
  callSendAPI(messageData);
}

function sendAudioTipForWeek(recipientId, week, tipNum) {
  var tip = "";
  try {
    var tip = audio.audio.translate(week + "-" + tipNum);
  } catch (err) {
    console.log("Week %s is missing audio tip number %s", week, tipNum);
    return;
  }
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: tip,
          is_reusable: "true"
        }
      }
    }
  };
  callSendAPI(messageData);
}

function optOut(senderID) {

}

function callSendAPI(messageData) {
  var access_token = "";
  try { // running locally
    access_token = config.get("PAGE_ACCESS_TOKEN");
  } catch(err) { // running on heroku
    access_token = process.env.PAGE_ACCESS_TOKEN;
  }
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: access_token },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });
}

function setGreetingMessage() {
  var greeting = {
  "greeting": [
    {
      "locale":"default",
      "text":"AmmiBot v1 is a tool to connect women in Pakistan with vital health and wellness information as they progress throughout their pregnancy."
    }, {
      "locale":"en_US",
      "text":"AmmiBot v1 is a tool to connect women in Pakistan with vital health and wellness information as they progress throughout their pregnancy."
    }, {
      "locale":"ur_PK",
      "text":"Welcome to Team Ammi Service in URDU v1"
    }]
  };
  var access_token = "";
  try { // running locally
    access_token = config.get("PAGE_ACCESS_TOKEN");
  } catch(err) { // running on heroku
    access_token = process.env.PAGE_ACCESS_TOKEN;
  }
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: { access_token: access_token },
    method: 'POST',
    json: greeting

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("Successfully sent greeting");
    } else {
      console.error("Unable to send greeting.");
      console.error(response);
      console.error(error);
    }
  });
}

function setGetStartedButton() {
  var button = {
    "get_started": {
      "payload":"get_started"
    }
  };
  var access_token = "";
  try { // running locally
    access_token = config.get("PAGE_ACCESS_TOKEN");
  } catch(err) { // running on heroku
    access_token = process.env.PAGE_ACCESS_TOKEN;
  }
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: { access_token: access_token },
    method: 'POST',
    json: button

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("Successfully set get_started button");
    } else {
      console.error("Unable to set get_started button.");
      console.error(response);
      console.error(error);
    }
  });
}

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  setGreetingMessage();
  setGetStartedButton();
  console.log("Listening on port %s", server.address().port);
});
