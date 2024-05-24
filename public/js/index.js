// Définition de la structure de l'objet pour un joueur dans le jeu.
const player = {
    // Indique si le joueur est l'hôte de la partie. Vrai si le joueur a créé la salle.
    host: false,
    // La cellule du plateau de jeu que le joueur a jouée lors de son dernier tour. Vide si le joueur n'a pas encore joué.
    playedCell: "",
    // L'identifiant de la salle de jeu dans laquelle le joueur se trouve. Null si le joueur n'est pas dans une salle.
    roomId: null,
    // Le nom d'utilisateur du joueur. Vide par défaut et défini par le joueur.
    username: "",
    // L'identifiant de socket associé à la connexion du joueur. Utilisé pour la communication en temps réel.
    socketId: "",
    // Le symbole attribué au joueur pour la partie, par exemple "X" ou "O".
    symbol: "X",
    // Indique si c'est au tour de ce joueur de jouer. Utile pour contrôler le flux du jeu.
    turn: false,
    // Indique si le joueur a gagné la partie. Vrai si le joueur a aligné une combinaison gagnante.
    win: false
};

// Initialisation de la connexion WebSocket pour la communication en temps réel avec le serveur.
const socket = io();

// Récupération de la chaîne de requête de l'URL actuelle pour extraire les paramètres.
const queryString = window.location.search;
// Analyse de la chaîne de requête pour obtenir les paramètres d'URL spécifiques.
const urlParams = new URLSearchParams(queryString);
// Tentative de récupération de l'ID de la salle à partir des paramètres d'URL, si spécifié.
const roomId = urlParams.get('room');

// Si un ID de salle est présent, modifie le texte du bouton de démarrage pour refléter
// la possibilité de rejoindre une salle existante plutôt que d'en créer une nouvelle.
if (roomId) {
    document.getElementById('start').innerText = "Rejoindre";
}

// Récupère l'élément input pour le nom d'utilisateur, permettant à l'utilisateur de le saisir.
const usernameInput = document.getElementById('username');

// Récupère les éléments de la carte de jeu et de la carte utilisateur, utilisés pour afficher
// les informations du jeu et de l'utilisateur respectivement.
const gameCard = document.getElementById('game-card');
const userCard = document.getElementById('user-card');

// Récupère les zones de redémarrage et d'attente, utilisées pour contrôler l'affichage
// lors du redémarrage d'une partie ou en attendant d'autres joueurs.
const restartArea = document.getElementById('restart-area');
const waitingArea = document.getElementById('waiting-area');

// Récupère les éléments relatifs à la gestion des salles, permettant d'afficher
// la liste des salles disponibles et de partager des liens vers la salle actuelle.
const roomsCard = document.getElementById('rooms-card');
const roomsList = document.getElementById('rooms-list');

// Récupère l'élément pour afficher des messages concernant le tour actuel,
// par exemple, indiquant quel joueur doit jouer.
const turnMsg = document.getElementById('turn-message');
// Récupère l'élément permettant d'afficher le lien à partager pour inviter d'autres joueurs à rejoindre la salle.
const linkToShare = document.getElementById('link-to-share');


// Initialisation d'une variable pour stocker le nom d'utilisateur de l'adversaire.
let ennemyUsername = "";

// Demande au serveur la liste des salles disponibles dès la connexion.
socket.emit('get rooms');

// Écoute de l'événement 'list rooms' émis par le serveur pour recevoir la liste des salles.
socket.on('list rooms', (rooms) => {
    // Initialisation d'une chaîne HTML vide pour construire la liste des salles.
    let html = "";

    // Vérifie si la liste des salles n'est pas vide.
    if (rooms.length > 0) {
        // Itère sur chaque salle reçue.
        rooms.forEach(room => {
            // Vérifie si la salle n'est pas pleine (moins de 2 joueurs).
            if (room.players.length !== 2) {
                // Construit un élément de liste HTML pour chaque salle disponible avec un bouton pour rejoindre.
                html += `<li class="list-group-item d-flex justify-content-between">
                            <p class="p-0 m-0 flex-grow-1 fw-bold">Salon de ${room.players[0].username} - ${room.id}</p>
                            <button class="btn btn-sm btn-success join-room" data-room="${room.id}">Rejoindre</button>
                        </li>`;
            }
        });
    }

    // Si la chaîne HTML n'est pas vide (salles disponibles), affiche la carte des salles et met à jour le contenu.
    if (html !== "") {
        roomsCard.classList.remove('d-none');
        roomsList.innerHTML = html;

        // Ajoute un gestionnaire d'événements sur chaque bouton "Rejoindre" pour permettre l'inscription à une salle.
        for (const element of document.getElementsByClassName('join-room')) {
            element.addEventListener('click', joinRoom, false);
        }
    }
});

// Gère la soumission du formulaire d'inscription/join de salle.
$("#form").on('submit', function (e) {
    // Empêche le comportement par défaut de soumission du formulaire.
    e.preventDefault();

    // Met à jour le nom d'utilisateur du joueur avec la valeur entrée.
    player.username = usernameInput.value;

    // Si un ID de salle est déjà spécifié (tentative de rejoindre une salle existante), le met à jour dans l'objet joueur.
    if (roomId) {
        player.roomId = roomId;
    } else {
        // Sinon, marque le joueur comme l'hôte de la nouvelle salle et son tour de jouer.
        player.host = true;
        player.turn = true;
    }
    player.socketId = socket.id;

    userCard.hidden = true;
    waitingArea.classList.remove('d-none');
    roomsCard.classList.add('d-none');

    socket.emit('playerData', player);
});

$(".cell").on("click", function (e) {
    const playedCell = this.getAttribute('id');

    if (this.innerText === "" && player.turn) {
        player.playedCell = playedCell;

        this.innerText = player.symbol;

        player.win = calculateWin(playedCell);
        player.turn = false;

        socket.emit('play', player);
    }
});

$("#restart").on('click', function () {
    restartGame();
})

socket.on('join room', (roomId) => {
    player.roomId = roomId;
    linkToShare.innerHTML = `<a href="${window.location.href}?room=${player.roomId}" target="_blank">${window.location.href}?room=${player.roomId}</a>`;
});

socket.on('start game', (players) => {
    console.log(players)
    startGame(players);
});

socket.on('play', (ennemyPlayer) => {

    if (ennemyPlayer.socketId !== player.socketId && !ennemyPlayer.turn) {
        const playedCell = document.getElementById(`${ennemyPlayer.playedCell}`);

        playedCell.classList.add('text-danger');
        playedCell.innerHTML = 'O';

        if (ennemyPlayer.win) {
            setTurnMessage('alert-info', 'alert-danger', `C'est perdu ! <b>${ennemyPlayer.username}</b> a gagné !`);
            calculateWin(ennemyPlayer.playedCell, 'O');
            showRestartArea();
            return;
        }

        if (calculateEquality()) {
            setTurnMessage('alert-info', 'alert-warning', "C'est une egalité !");
            return;
        }

        setTurnMessage('alert-info', 'alert-success', "C'est ton tour de jouer");
        player.turn = true;
    } else {
        if (player.win) {
            $("#turn-message").addClass('alert-success').html("Félicitations, tu as gagné la partie !");
            showRestartArea();
            return;
        }

        if (calculateEquality()) {
            setTurnMessage('alert-info', 'alert-warning', "C'est une egalité !");
            showRestartArea();
            return;
        }

        setTurnMessage('alert-success', 'alert-info', `C'est au tour de <b>${ennemyUsername}</b> de jouer`)
        player.turn = false;
    }
});

socket.on('play again', (players) => {
    restartGame(players);
})

function startGame(players) {
    restartArea.classList.add('d-none');
    waitingArea.classList.add('d-none');
    gameCard.classList.remove('d-none');
    turnMsg.classList.remove('d-none');

    const ennemyPlayer = players.find(p => p.socketId != player.socketId);
    ennemyUsername = ennemyPlayer.username;

    if (player.host && player.turn) {
        setTurnMessage('alert-info', 'alert-success', "C'est ton tour de jouer");
    } else {
        setTurnMessage('alert-success', 'alert-info', `C'est au tour de <b>${ennemyUsername}</b> de jouer`);
    }
}

function restartGame(players = null) {
    if (player.host && !players) {
        player.turn = true;
        socket.emit('play again', player.roomId);
    }

    const cells = document.getElementsByClassName('cell');

    for (const cell of cells) {
        cell.innerHTML = '';
        cell.classList.remove('win-cell', 'text-danger');
    }

    turnMsg.classList.remove('alert-warning', 'alert-danger');

    if (!player.host) {
        player.turn = false;
    }

    player.win = false;

    if (players) {
        startGame(players);
    }
}

function showRestartArea() {
    if (player.host) {
        restartArea.classList.remove('d-none');
    }
}

function setTurnMessage(classToRemove, classToAdd, html) {
    turnMsg.classList.remove(classToRemove);
    turnMsg.classList.add(classToAdd);
    turnMsg.innerHTML = html;
}

function calculateEquality() {
    let equality = true;
    const cells = document.getElementsByClassName('cell');

    for (const cell of cells) {
        if (cell.textContent === '') {
            equality = false;
        }
    }

    return equality;
}

function calculateWin(playedCell, symbol = player.symbol) {
    let row = playedCell[5];
    let column = playedCell[7];


    // 1) VERTICAL (check if all the symbols in clicked cell's column are the same)
    let win = true;

    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${i}-${column}`).text() !== symbol) {
            win = false;
        }
    }

    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${i}-${column}`).addClass("win-cell");
        }

        return win;
    }

    // 2) HORIZONTAL (check the clicked cell's row)

    win = true;
    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${row}-${i}`).text() !== symbol) {
            win = false;
        }
    }

    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${row}-${i}`).addClass("win-cell");
        }

        return win;
    }

    // 3) MAIN DIAGONAL (for the sake of simplicity it checks even if the clicked cell is not in the main diagonal)

    win = true;

    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${i}-${i}`).text() !== symbol) {
            win = false;
        }
    }

    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${i}-${i}`).addClass("win-cell");
        }

        return win;
    }

    // 3) SECONDARY DIAGONAL

    win = false;
    if ($("#cell-1-3").text() === symbol) {
        if ($("#cell-2-2").text() === symbol) {
            if ($("#cell-3-1").text() === symbol) {
                win = true;

                $("#cell-1-3").addClass("win-cell");
                $("#cell-2-2").addClass("win-cell");
                $("#cell-3-1").addClass("win-cell");

                return win;
            }
        }
    }
}

const joinRoom = function () {
    if (usernameInput.value !== "") {
        player.username = usernameInput.value;
        player.socketId = socket.id;
        player.roomId = this.dataset.room;

        socket.emit('playerData', player);

        userCard.hidden = true;
        waitingArea.classList.remove('d-none');
        roomsCard.classList.add('d-none');
    }
}
