'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
const config = require('config');
const messages = require('./messages.js');
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

  if (messageText) {
    if(messageText.toLowerCase().includes("weeks") || messageText.toLowerCase().includes("week") || isANumber(messageText)) {
        var pregnancyWeek = messageText;
        if(!isANumber(messageText)) {
          pregnancyWeek = messageText.split(" ")[0];
        }
        var user = users.find({'senderID': senderID});
        if(user.length != 0) {
          if(user[0].pregnancyWeek == undefined) {
            user[0].pregnancyWeek = pregnancyWeek;
            user[0].currWeek = pregnancyWeek;
            users.update(user);
          }
          scheduleTipsStartingAtWeek(senderID, pregnancyWeek);
        } else {
          console.error("This user %s is not in the database", senderID);
        }
    } else {
      sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function isANumber(str){
  return !/\D/.test(str);
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
    sendPregnancyStateMessage(senderID);
  } else if(payload.includes("ACTION")) {
    var action = payload.split(":")[1];
    switch(action) {
      case 'OPT-OUT':
        console.log('TODO: opt-out');
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
      text: messages.msgs.translate("PREGNANCY_STATE")
    }
  };
  callSendAPI(messageData);
}

function scheduleTipsStartingAtWeek(recipientId, pregnancyWeek) {
  var today = new Date();
  var day = today.getDay();
  var hour = today.getHours();
  var minute = today.getMinutes();

  sendTipForWeek(recipientId, pregnancyWeek, 1);
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
  }.bind(null, recipientId));

  schedule.scheduleJob({hour: 9, minute: 0, dayOfWeek: 6}, function() {
    var user = users.find({'senderID': recipientId});
    var weak = user[0].currWeek;
    sendTipForWeek(recipientId, week, 2);
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

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});
