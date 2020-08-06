

//import * as functions from 'firebase-functions';
'use strict'

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript


//const onMessageCreate = require('./onMessageCreate')
// const callNewGame = require('./call_new_game')
//exports.onMessageCreate = onMessageCreate.onMessageCreate
// exports.newMsg = callNewGame.newMsg



const preGame = require("./gamePreparation");
exports.gamePreparation = preGame.gamePreparation;

const game = require("./moderator")
exports.moderator = game.moderator;
// const new_game = require("./call_new_game");
// exports.newMsg = new_game.newMsg;

