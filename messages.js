"use strict";
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

exports.msgs = msgs;