import * as functions from "firebase-functions";
import admin = require("firebase-admin");

"use strict";
let userInfo: any;
let gameCode: string;
let request: string, idx: string;
let MSG_TOPIC: string;

function extractNumberFromPromise(index: any) {
    return parseInt(extractStringFromPromise(index))
}

function extractStringFromPromise(input: any) {
    return JSON.stringify(input).replace(/\"/g, "")
}

exports.moderator = functions.https.onCall((data, context) => {
    async function newScenario(type: string, msgData: any) {
        const scenarioID: any = await pushValue(ref.child("stages"),
            {"scenario": type, "index": 0, "id": ""});
        await setValue(ref.child("stages").child("current_scenario"), scenarioID);
        if (msgData !== null)
            await sendMessage(MSG_TOPIC, msgData);
    }

    async function ready() {
        const subRef = ref
            .child("/Players/lobby")
            .child(userInfo.uid)
            .child("status");

        async function goAlong() {
            try {
                let gameSize: any = await readValue(ref.child("gameSize"));
                let readyPlayers: any = await intIncrementer(ref.child("readyPlayers"));
                gameSize = extractNumberFromPromise(gameSize);
                readyPlayers = parseInt(readyPlayers.snapshot?.val());
                if (gameSize === readyPlayers) {
                    const msgData = {
                        instruction: "start_stage"
                    }
                    await newScenario("roles", msgData);
                }
                await setValue(subRef.ref, "ready");
                return
            } catch (e) {
                console.log(e.message);
            }
            return;
        }

        return subRef
            .once("value")
            .then(function (snapshot) {
                if (snapshot.val() === "pending") {
                    goAlong().catch((er) => {
                        console.error(er.message);
                    });
                }
            })
            .catch((er) => {
                console.log("Error on READY!!!:", er.message);
            });
    }

    async function next() {
        function genNextScenario(current_scenario: any, gameSize: any) {
            switch (current_scenario) {
                case "roles":
                    // return "intro";
                    return "init_vote"
                case "intro":
                    if (gameSize > 6)
                        return "mafia_intro";
                    else
                        return "conv(all)"
                case "mafia_intro":
                    return "conv(all)";
                case "conv(all)":
                    return "init_vote";
                case "init_vote":
                    return "conv(susp)";
                case "conv(susp)":
                    return "final_vote";
                case "final_vote":
                    return "mafia_shot";
                case "mafia_shot":
                    return "doc_heal";
                case "doc_heal":
                    if (gameSize > 6)
                        return "det_ask";
                    else
                        return "conv(all)"
                case "det_ask":
                    return "conv(all)";
                default:
                    return "null"
            }
        }

        try {
            let current_scenario: any = await readValue(ref.child("stages/current_scenario"));
            current_scenario = extractStringFromPromise(current_scenario);
            current_scenario = ref.child("stages").child(current_scenario);
            let index: any = await intIncrementer(current_scenario.child("index"));
            index = parseInt(index.snapshot?.val());
            //let name: any = await readValue(ref.child("Players/list").child(index));
            //name = extractStringFromPromise(name);
            //await setValue(current_scenario.child("name"), name);
            let scenario: any = await readValue(current_scenario.child("scenario"));
            scenario = extractStringFromPromise(scenario);
            let gameSize: any = await readValue(ref.child("gameSize"));
            gameSize = extractNumberFromPromise(gameSize);
            if (index === gameSize) {
                console.log(scenario);
                const nextScenario = genNextScenario(scenario, gameSize);
                await newScenario(nextScenario, null);
            }
            return Promise.resolve(index);
        } catch (e) {
            console.log(e.message);
        }
        return Promise.reject();
    }

    async function vote() {
        try {
            let current_session: any = await readValue(ref.child("votes/current_session"));
            current_session = extractStringFromPromise(current_session);
            const subRef: any = ref.child("votes").child(current_session).child(idx);
            await intIncrementer(subRef.child("total"));
            await pushValue(subRef, userInfo.name);
            /*if (current_session === "null") {
                // console.log("Session not exists")
                //const sessionId : any = pushValue(ref.child("votes"))
            } else {
                // console.log("Current session:", current_session);
            }*/
            return Promise.resolve();
        } catch (e) {
            console.log(e.message);
        }
        return Promise.reject();
    }

    function process_request() {
        switch (request) {
            case "ready":
                return ready();
            case "next":
                return next();
            case "vote":
                return vote();
            case "joinGame":
                break;
            case "leaveGame":
                break;
            case "startGame":
                break;
            case "endGame":
                break;
            default:
                throwError("invalid-argument", "unknown request");
        }
        return;
    }

    function isValid(text: any, minLength: number) {
        return !(!(typeof text === "string") || text.length >= minLength);
    }

    gameCode = data.code;
    request = data.request;
    idx = data.index;
    MSG_TOPIC = "mafia-" + gameCode;
    const ref = admin.database().ref("games").child(gameCode);

    if (gameCode === "" || request === "") {
        throwError("failed-precondition", "Invalid arguments");
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
        };
    }
    if (isValid(gameCode, 6))
        throwError("invalid-argument", "Invalid game gameCode");
    if (userInfo.name === undefined) {
        userInfo.name = "user";
    }

    console.log("Processing request has started:", request, gameCode, userInfo.email.toUpperCase());
    process_request();
});

async function pushValue(reference: admin.database.Reference, data: any) {
    const childRef = reference.push();
    childRef.set(data).catch((er: any) => {
        throw new functions.https.HttpsError("unknown", er.message);
    });
    return childRef.key;
    // return reference.push(data).then(() => {
    //     return data.key
    // }).catch((er) => console.log(er.message));

}

async function sendMessage(topic: string, data: any) {
    const message = {
        data: data,
        topic: topic
    }
    return admin.messaging().send(message);
}

function throwError(prompt: String, desc: string) {
    console.log("Error:", prompt, desc);
    throw new functions.https.HttpsError("invalid-argument", String(desc));
}

async function intIncrementer(reference: admin.database.Reference) {
    return reference.transaction(function (current_value) {
        return (current_value || 0) + 1;
    });
}

async function setValue(reference: admin.database.Reference, data: any) {
    try {
        return reference.set(data);
    } catch (er) {
        throw new functions.https.HttpsError("unknown", er.message, er);
    }
}

function readValue(ref: admin.database.Reference) {
    return ref
        .once("value", function (snapshot) {
            if (snapshot.exists())
                return snapshot.val();
            else
                return null;
        })
        .catch((er) => {
            console.log(er.message);
        });
}
