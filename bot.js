'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
const config = require('config');
const localize = require('localize');

let msgs = new localize({
  "INTRO": {
    "EN": "Team Ammi believes that every woman in Pakistan should be safe, healthy and informed. This is why we created AmmiBot. AmmiBot is a tool to connect women in Pakistan with vital health and wellness information. Our first feature is aimed at informing women with maternal health information as they progress throughout their pregnancy. Press the 'Let's Get Started' button to try it out!",
    "UR": "Urdu -> welcome to ammi service"
  },
  "PREGNANCY_STATE": {
    "EN": "How much time has passed since you last had your period? Please enter in the form <X> weeks.",
    "UR": "Urdu -> how much time has passed since you last had your period?"
  },
  "OPT-OUT": {
    "EN": "Click to opt-out",
    "UR": "Urdu -> click to opt-out"
  },
  "5-1": {
    "EN": "Welcome! Congratulations on your pregnancy. This is a very exciting time for you – but you might have some questions. It seems you are in month two of your pregnancy. Pregnancy is divided into three parts, each three months long. Ammi service will send you weekly messages with tips, advice, and information so you and your baby are healthy! If you haven’t yet, please plan to go to a clinic soon or the LHW of your community",
    "UR": "week 5 msg 1 in urdu"
  },
  "5-2-1": {
    "EN": "You might want to keep your pregnancy a secret. But the best thing you can do is talk to a LHW. She will be your friend on your journey to motherhood; Regular clinic visits in pregnancy help detect problems before they happen. Find out where your nearest clinic is. Even though you are perfectly healthy, you should have at least four clinic visits during pregnancy to make sure you and your baby are well.  try to go once before your third month ends, once before your 6th month, and twice in the last three months.Talk to your family about why it is important for  you to go to regular clinic visits.",
    "UR": "week 5 1 msg 2 a in urdu"
  },
  "5-2-2": {
    "EN": "You might be feeling tired and nauseous. Most women do in early pregnancy. Try having some ginger, mint or lemon tea, and rest if you can.  Ask your LHW about Iron and Folic Acid tablets -- taking one every day it will help your baby grow well.",
    "UR": "week 5 msg 2 b in urdu"
  },
  "6-1": {
    "EN": "Spotting or light bleeding is worrying but very common in pregnancy. Slight bleeding is very common in early pregnancy. You may worry that it's a sign of a miscarriage. But there can be many reasons for bleeding. Some women have bleeding when they would usually have their period. Or it may mean that your baby is attaching himself to your womb. Rest for a while if you can.",
    "UR": "week 6 msg 1 in urdu"
  },
  "6-2": {
    "EN": "Regular clinic visits in pregnancy help detect problems before they happen. Go to the clinic if the bleeding is heavy, or if it comes with stomach pain. You need to go to the clinic immediately if you cannot lift your arm above your shoulder or if there is a pain in your shoulder. If you are worried about your pregnancy, talk to your LHW She'll be happy to answer your questions.",
    "UR": "week 6 msg 2 in urdu"
  }
});
//TODO: move all such calls to an 'init' method
msgs.setLocale("EN");

var messengerButton = "<html><head><title>Ammi Service</title></head><body><h1>Ammi Service</h1>This is a bot based on Messenger Platform QuickStart.</body></html>";

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

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
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
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

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
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
        sendMessageForStep(senderID, 1);
        break;
      case 'generic':
        sendGenericMessage(senderID);
        break;
      default:
        if(messageText.includes("weeks")) {
          var pregnancyWeek = messageText.split(" ")[0];
          sendTipForWeek(senderID, pregnancyWeek);
          sendSecondTipForWeek(senderID, pregnancyWeek);
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
      msgs.setLocale(decodedPayload[1]);
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

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  //sendTextMessage(senderID, "Postback called");
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

function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
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
            text: msgs.translate("INTRO"),
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
        text: msgs.translate("PREGNANCY_STATE")
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
          text: msgs.translate(week+"-1"),
          buttons: [{
            type: "postback",
            title: msgs.translate("OPT-OUT"),
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
          text: msgs.translate(week+"-2"),
          buttons: [{
            type: "postback",
            title: msgs.translate("OPT-OUT"),
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
