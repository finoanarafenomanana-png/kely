// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {

    apiKey: "AIzaSyDLjBGg_tIz56FgmIIuEAJEN6iBKvNe9KI",

    authDomain:
        "gestion-de-ferme-avicole.firebaseapp.com",

    databaseURL:
        "https://gestion-de-ferme-avicole-default-rtdb.firebaseio.com",

    projectId:
        "gestion-de-ferme-avicole",

    storageBucket:
        "gestion-de-ferme-avicole.firebasestorage.app",

    messagingSenderId:
        "821182593543",

    appId:
        "1:821182593543:web:b252d03a9adb4d554548a2",

    measurementId:
        "G-SF2SS97VWT"
};


// ============================================================
// INITIALISATION FIREBASE
// ============================================================

firebase.initializeApp(firebaseConfig);

const database = firebase.database();


// ============================================================
// ELEMENTS HTML
// ============================================================

const $ = (id) =>
    document.getElementById(id);

const firebaseLed =
    $("firebaseLed");

const firebaseText =
    $("firebaseText");

const logBox =
    $("logBox");


// ============================================================
// JOURNAL
// ============================================================

function log(message, type = "") {

    const div =
        document.createElement("div");

    div.className =
        "entry " + type;

    const time =
        new Date().toLocaleTimeString(
            "fr-FR",
            { hour12: false }
        );

    div.textContent =
        `[${time}] ${message}`;

    logBox.appendChild(div);

    logBox.scrollTop =
        logBox.scrollHeight;
}


// ============================================================
// TEST CONNEXION FIREBASE
// ============================================================

database
    .ref(".info/connected")
    .on("value", snapshot => {

        if (snapshot.val() === true) {

            firebaseLed.className =
                "connected";

            firebaseText.textContent =
                "Firebase connecté";

            log(
                "Connexion Firebase réussie.",
                "success"
            );

        } else {

            firebaseLed.className = "";

            firebaseText.textContent =
                "Firebase déconnecté";

            log(
                "Firebase déconnecté.",
                "error"
            );
        }
    });


// ============================================================
// FIREBASE → WEB
// Lecture en temps réel
// ============================================================

database
    .ref("afficheur")
    .on("value", snapshot => {

        const data =
            snapshot.val();

        if (!data) {

            log(
                "Aucune donnée dans afficheur."
            );

            return;
        }


        // Température

        if (
            typeof data.temperature
            === "number"
        ) {

            $("temp").textContent =
                data.temperature.toFixed(1)
                + " °C";
        }


        // Humidité

        if (
            typeof data.humidite
            === "number"
        ) {

            $("hum").textContent =
                data.humidite.toFixed(1)
                + " %";
        }


        // Niveau aliment

        if (
            typeof data.niveau_aliment
            === "number"
        ) {

            $("silo").textContent =
                data.niveau_aliment.toFixed(1)
                + " cm";
        }


        // Niveau eau

        if (
            data.niveau_eau !== undefined
        ) {

            $("water").textContent =
                data.niveau_eau;
        }


        log(
            "Données Firebase reçues."
        );
    });


// ============================================================
// FIREBASE → WEB : ACTIONNEURS
// ============================================================

database
    .ref("actionneurs")
    .on("value", snapshot => {

        const data =
            snapshot.val();

        if (!data) return;


        // Pompe

        if (
            data.pompe === true
        ) {

            $("pumpState").textContent =
                "ON";

            $("pumpState")
                .className =
                "pill on";

        } else {

            $("pumpState").textContent =
                "OFF";

            $("pumpState")
                .className =
                "pill";
        }


        // Moteur aliment

        if (
            data.moteur_aliment === true
        ) {

            $("feedState").textContent =
                "EN COURS";

            $("feedState")
                .className =
                "pill active";

        } else {

            $("feedState").textContent =
                "Inactive";

            $("feedState")
                .className =
                "pill";
        }
    });


// ============================================================
// WEB → FIREBASE
// Test d'écriture
// ============================================================

function testFirebaseWrite() {

    database
        .ref("test_web")
        .set({

            message:
                "Connexion Web réussie",

            date:
                new Date().toISOString()
        })

        .then(() => {

            log(
                "Écriture Firebase réussie.",
                "success"
            );

        })

        .catch(error => {

            log(
                "Erreur Firebase : "
                + error.message,
                "error"
            );
        });
}


// ============================================================
// WEB SERIAL ESP32
// ============================================================

let port = null;
let reader = null;
let writer = null;
let keepReading = false;
let lineBuffer = "";


// ============================================================
// CONNEXION ESP32
// ============================================================

async function connectESP32() {

    try {

        port =
            await navigator.serial.requestPort();

        await port.open({
            baudRate: 115200
        });

        $("led").className =
            "led on";

        $("connText").textContent =
            "Connecté";

        $("connectBtn").textContent =
            "Déconnecter";

        writer =
            port.writable.getWriter();

        keepReading = true;

        log(
            "ESP32 connecté."
        );

        readLoop();

    }

    catch (error) {

        log(
            "Erreur ESP32 : "
            + error.message,
            "error"
        );
    }
}


// ============================================================
// DECONNEXION ESP32
// ============================================================

async function disconnectESP32() {

    keepReading = false;

    try {

        if (reader) {

            await reader.cancel();

            reader.releaseLock();
        }

    } catch (e) {}


    try {

        if (writer) {

            writer.releaseLock();
        }

    } catch (e) {}


    try {

        if (port) {

            await port.close();
        }

    } catch (e) {}


    port = null;

    reader = null;

    writer = null;


    $("led").className =
        "led";

    $("connText").textContent =
        "Déconnecté";

    $("connectBtn").textContent =
        "Connecter ESP32";

    log(
        "ESP32 déconnecté."
    );
}


// ============================================================
// LECTURE ESP32
// ============================================================

async function readLoop() {

    const decoder =
        new TextDecoderStream();

    const readableClosed =
        port.readable.pipeTo(
            decoder.writable
        );

    reader =
        decoder.readable.getReader();


    try {

        while (keepReading) {

            const {
                value,
                done
            } =
                await reader.read();


            if (done) break;


            if (value) {

                lineBuffer += value;

                let index;


                while (
                    (index =
                        lineBuffer.indexOf("\n"))
                    !== -1
                ) {

                    const line =
                        lineBuffer
                            .slice(0, index)
                            .trim();


                    lineBuffer =
                        lineBuffer
                            .slice(index + 1);


                    if (line) {

                        handleESP32Data(
                            line
                        );
                    }
                }
            }
        }

    }

    catch (error) {

        log(
            "Connexion ESP32 perdue.",
            "error"
        );
    }
}


// ============================================================
// ESP32 JSON → FIREBASE
// ============================================================

function handleESP32Data(line) {

    let data;


    try {

        data =
            JSON.parse(line);

    }

    catch (error) {

        return;
    }


    if (
        data.type !== "status"
    ) {

        return;
    }


    // Affichage Web

    if (
        typeof data.temp === "number"
    ) {

        $("temp").textContent =
            data.temp.toFixed(1)
            + " °C";
    }


    if (
        typeof data.hum === "number"
    ) {

        $("hum").textContent =
            data.hum.toFixed(1)
            + " %";
    }


    if (
        typeof data.silo_cm === "number"
    ) {

        $("silo").textContent =
            data.silo_cm.toFixed(1)
            + " cm";
    }


    if (
        data.water_raw !== undefined
    ) {

        $("water").textContent =
            data.water_raw;
    }


    // ----------------------------------------
    // ESP32 → FIREBASE
    // ----------------------------------------

    database
        .ref("capteurs")
        .update({

            temperature:
                data.temp ?? null,

            humidite:
                data.hum ?? null,

            niveau_aliment:
                data.silo_cm ?? null,

            niveau_eau:
                data.water_raw ?? null,

            derniere_maj:
                new Date().toISOString()
        });


    database
        .ref("actionneurs")
        .update({

            pompe:
                data.pump === true,

            moteur_aliment:
                data.feeding === true
        });


    database
        .ref("systeme")
        .update({

            esp32: "ONLINE",

            derniere_maj:
                new Date().toISOString()
        });


    log(
        "Données ESP32 → Firebase."
    );
}


// ============================================================
// ENVOI COMMANDE ESP32
// ============================================================

async function sendCommand(command) {

    if (!writer) {

        log(
            "ESP32 non connecté.",
            "error"
        );

        return;
    }


    const encoder =
        new TextEncoder();


    await writer.write(

        encoder.encode(
            command + "\n"
        )
    );


    // Enregistrer commande Firebase

    database
        .ref("commandes")
        .push({

            commande: command,

            date:
                new Date().toISOString()
        });


    log(
        "Commande : " + command
    );
}


// ============================================================
// BOUTON CONNEXION ESP32
// ============================================================

$("connectBtn")
    .addEventListener(
        "click",

        () => {

            if (port) {

                disconnectESP32();

            } else {

                connectESP32();
            }
        }
    );


// ============================================================
// BOUTONS COMMANDES
// ============================================================

document
    .querySelectorAll("[data-cmd]")
    .forEach(button => {

        button.addEventListener(
            "click",

            () => {

                sendCommand(
                    button.dataset.cmd
                );
            }
        );
    });


// ============================================================
// INTERVALLE
// ============================================================

$("applyInterval")
    .addEventListener(
        "click",

        () => {

            const minutes =
                parseInt(
                    $("intervalInput").value
                );


            if (
                isNaN(minutes)
                ||
                minutes <= 0
            ) {

                log(
                    "Intervalle invalide.",
                    "error"
                );

                return;
            }


            sendCommand(
                `SET_INTERVAL ${minutes * 60}`
            );
        }
    );


// ============================================================
// DUREE
// ============================================================

$("applyDuration")
    .addEventListener(
        "click",

        () => {

            const seconds =
                parseInt(
                    $("durationInput").value
                );


            if (
                isNaN(seconds)
                ||
                seconds <= 0
            ) {

                log(
                    "Durée invalide.",
                    "error"
                );

                return;
            }


            sendCommand(
                `SET_DURATION ${seconds}`
            );
        }
    );


// ============================================================
// TEST AUTOMATIQUE
// ============================================================

log(
    "Application Web démarrée."
);

testFirebaseWrite();


// ============================================================
// VERIFICATION WEB SERIAL
// ============================================================

if (
    !("serial" in navigator)
) {

    $("notSupported").style.display =
        "block";

    $("connectBtn").disabled =
        true;

    log(
        "Web Serial non disponible.",
        "error"
    );
}