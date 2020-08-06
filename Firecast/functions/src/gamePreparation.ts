import * as functions from "firebase-functions";
import admin = require("firebase-admin");

"use strict";
let userInfo: any;


admin.initializeApp();

exports.gamePreparation = functions.https.onCall((data, context) => {
    const gameCode: string = data.code;
    const request: string = data.request;

    function isValid(text: any, minLength: number) {
        return !(!(typeof text === "string") || text.length >= minLength);
    }

    if (gameCode === "" || request === "") {
        throwError("failed-precondition",
            "Invalid arguments")
    }

    if (!context.auth) {
        throwError(
            "failed-precondition",
            "The function must be called " + "while authenticated."
        );
    } else {
        userInfo = {
            uid: context.auth.uid,
            name: context.auth.token.name,
            email: context.auth.token.email,
            status: "pending",
        };
    }


    if (isValid(gameCode, 6)) throwError("invalid-argument", "Invalid game gameCode");
    if (userInfo.name === undefined) {
        userInfo.name = "user";
    }
    console.log("Processing request has started", gameCode, userInfo.name);
    switch (request) {
        case "newGame":
            newGame(gameCode);
            break;
        case "destroyGame":
            destroyGame(gameCode)
            break;
        case "archiveGame":
            break;
        case "joinGame":
            joinGame(gameCode);
            break;
        case "leaveGame":
            break;
        case "startGame":
            startGame(gameCode);
            const msgData = {
                instruction: "start"
            }
            sendMessage("mafia-ABCDEF", msgData);
            break;
        case "endGame":
            break;
        default:
            throwError("invalid-argument", "unknown request");
    }
    console.log("Processing request has ended", "end");
});

function newGame(gameCode: string) {
    const ref = admin.database().ref("/games").child(gameCode);
    setValue(ref.child("/Players/lobby").child(userInfo.uid), userInfo);
}

function joinGame(gameCode: string) {
    const ref = admin.database().ref("/games").child(gameCode);
    setValue(ref.child("Players/lobby").child(userInfo.uid), userInfo);
}

function destroyGame(gameCode: string) {
    const ref = admin.database().ref("/games").child(gameCode);
    setValue(ref, null)
    console.log("Destroying game:", gameCode);
}

function startGame(gameCode: string) {
    const ref = admin.database().ref("games").child(gameCode);
    const lobbyRef = ref.child("/Players/lobby");
    let nameList: any = [];
    let groupSize: number = 0;


    function generateRoles(size: number): string[] {
        const baseRoles: string[] = ["Doctor", "Civilian", "Civilian", "Civilian", "Mafia"];
        if (size === 6)
            baseRoles.push("Civilian")
        else if (size > 6) {
            baseRoles.push("Detective")
            baseRoles.push("Godfather")
        }
        let needsCivilian: boolean = true;
        for (let currentLen = baseRoles.length; currentLen < size; currentLen++) {
            if (needsCivilian)
                baseRoles.push("Civilian");
            else
                baseRoles.push("Mafia");
            needsCivilian = !needsCivilian;
        }
        return shuffle(baseRoles);
    }

    function shuffle(array: Array<string>) {
        let m = array.length, t, i;
        // While there remain elements to shuffle…
        while (m) {
            // Pick a remaining element…
            i = Math.floor(Math.random() * m--);
            // And swap it with the current element.
            t = array[m];
            array[m] = array[i];
            array[i] = t;
        }
        return array;
    }

    lobbyRef.once('value').then(function (snapshot) {
        groupSize = snapshot.numChildren()
        const roles: string[] = generateRoles(groupSize);
        setValue(ref.child("gameSize"), groupSize)
        snapshot.forEach(function (childSnapshot) {
            const key = childSnapshot.key;
            const value = childSnapshot.val();
            const name = value.name;
            nameList.push(name)
            if (key !== null) {
                setValue(lobbyRef.child(key).child("index"), nameList.length - 1)
                setValue(lobbyRef.child(key).child("role"), roles[nameList.length - 1])
            }
        });
    }).then(() => {
        setValue(ref.child("stages").child("players_list"), nameList);
        setValue(ref.child("readyPlayers"), 0);
    }).catch((er) => {
        throwError("Error", er.message);
    });
}

// function readValue(ref: admin.database.Reference) {
//     let value: any = null;
//     ref.on(
//         "value",
//         function (snapshot) {
//             console.log("value:", snapshot.val());
//             value = snapshot.val();
//         },
//         function (errorObject) {
//             console.log("The read failed: " + errorObject.message);
//         }
//     );
//     return value;
// }


function setValue(reference: admin.database.Reference, data: any) {
    reference.set(data).catch((er: any) => {
        throw new functions.https.HttpsError("unknown", er.message, er);
    });
}

function sendMessage(topic: string, data: any): boolean {
    const message = {
        data: data,
        topic: topic
    }
    admin.messaging().send(message).then(response => {
        console.log('Successfully sent message:', response);
        return true
    }).catch(er => {
        console.log('Error sending message:', er);
    });
    return false;
}

function throwError(prompt: String, desc: string) {
    console.log("Error:", prompt, desc);
    throw new functions.https.HttpsError("invalid-argument", String(desc));
}