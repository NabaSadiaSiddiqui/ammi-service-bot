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
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === config.get("VERIFY_TOKEN")) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

// Display the web page
app.get('/', function(req, res) {
  var messengerButton = "<html><head><title>Ammi Service</title></head><body><h1>Ammi Service</h1>This is a bot based on Messenger Platform QuickStart.</body></html>";
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
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'hi':
      case 'hello':
      case 'hey':
        if(users.find( {'senderID': senderID} ).length == 0) {
          users.insert({'senderID': senderID});
        }
        sendMessageForStep(senderID, 1);
        break;
      default:
        if(messageText.includes("weeks")) {
          var pregnancyWeek = messageText.split(" ")[0];
          var user = users.find({'senderID': senderID});
          if(user.length != 0) {
            if(user[0].pregnancyWeek == undefined) {
              user[0].pregnancyWeek = pregnancyWeek;
              user[0].currWeek = pregnancyWeek;
              users.update(user);
            }
            scheduleTipsStartingAtWeek(senderID, pregnancyWeak);
          } else {
            console.error("This user %s is not in the database", senderID);
          }
        } else {
          sendTextMessage(senderID, messageText);
        }
    }
  } else if (messageAttachments) {
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

  var decodedPayload = payload.split(":");
  switch (decodedPayload[0]) {
    case 'LANG':
      messages.msgs.setLocale(decodedPayload[1]);
      sendMessageForStep(senderID, 2);
      break;
    case 'STEP':
      sendMessageForStep(senderID, decodedPayload[1]);
      break;
    case 'ACTION':
      if(decodedPayload[1] == 'OPT-OUT') {
        //TODO: opt-out user from susbscription
        console.log('TODO: Opt-out')
      }
    default:
      sendTextMessage(senderID, "Postback called");
  }
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function sendMessageForStep(recipientId, step) {
  var messageData;

  if(step == 1) {
    messageData = {
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
              payload: "LANG:EN"
            }, {
              type: "postback",
              title: "Urdu",
              payload: "LANG:UR"
            }]
          }
        }
      }
    };
  } else if(step == 2) {
    messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: messages.msgs.translate("INTRO"),
            buttons: [{
              type: "postback",
              title: "Let's Get Started",
              payload: "STEP:3"
            }]
          }
        }
      }
    };
  } else if(step == 3) {
    messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        text: messages.msgs.translate("PREGNANCY_STATE")
      }
    };
  } else {
    messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Team Ammi needs to see what the next steps from here are...",
            buttons: [{
              type: "postback",
              title: "Let's Get Started",
              payload: "STEP:3"
            }]
          }
        }
      }
    };
  }

  callSendAPI(messageData);
}

function scheduleTipsStartingAtWeek(recipientId, pregnancyWeek) {
  var today = new Date();
  var day = today.getDay();
  var hour = today.getHours();
  var minute = today.getMinutes();

  if(day <= 4) {
    // schedule the first tip to time marked by today
    schedule.scheduleJob({hour: hour, minute: minute, dayOfWeek: day}, function() {
      var user = users.find({'senderID': recipientId});
      var week = user[0].currWeek;
      sendTipForWeek(recipientId, week);
    ).bind(null, recipientId);

    // schedule second tip to Saturday, which is end of the week
    schedule.scheduleJob({hour: 9, minute: 0, dayOfWeek: 6}, function() {
      var user = users.find({'senderID': recipientId});
      var weak = user[0].currWeek;
      sendSecondTipForWeek(recipientId, week);
      user[0].week++;
      users.update(user);
    ).bind(null, recipientId);
  } else {
    // Today is one of Friday, Saturday or Sunday.
    // We will send this week's tip, and schedule the first tip to be sent on
    // Tuesday and second tip on Saturday for all coming weeks
    sendTipForWeek(senderID, pregnancyWeek);

    // move to next week
    var user = users.find({'senderID': recipientId});
    user[0].currWeek = user[0].currWeek++;
    users.update(user);

    schedule.scheduleJob({hour: 9, minute: 0, dayOfWeek: 2}, function() {
      var user = users.find({'senderID': recipientId});
      var week = user[0].currWeek;
      sendTipForWeek(recipientId, week);
    ).bind(null, recipientId);

    schedule.scheduleJob({hour: 9, minute: 0, dayOfWeek: 6}, function() {
      var user = users.find({'senderID': recipientId});
      var weak = user[0].currWeek;
      sendSecondTipForWeek(recipientId, week);
      user[0].week++;
      users.update(user);
    ).bind(null, recipientId);
  }
}

function sendTipForWeek(recipientId, week) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: messages.msgs.translate(week+"-1"),
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

function sendSecondTipForWeek(recipientId, week) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: messages.msgs.translate(week+"-2"),
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
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: config.get("PAGE_ACCESS_TOKEN") },
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
