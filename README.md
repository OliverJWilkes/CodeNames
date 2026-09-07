# Family Codenames

A word-linking game for two teams, playable in any web browser on phones, tablets and PCs.
Everyone joins the same room with a four-letter code; the server keeps the game in sync in real time.

## How to play

- 25 words sit in a 5 x 5 grid. Secretly, 9 belong to the starting team, 8 to the other team,
  7 are blank, and 1 is the **assassin**.
- Each team has a **teller** and a **guesser**. The teller sees the colours; the guesser does not.
- The starting team is chosen at random.
- On your turn the teller types a **one-word clue** and a **number** (how many words it links to).
  The clue cannot be a word on the board.
- The guesser taps words. They may guess up to the number plus one. A correct colour lets them keep going.
  Picking the other team's colour or a blank ends the turn (and the other team's word counts for them).
  The guesser can also press **End turn** early.
- **Win** by revealing all of your colour, or when the other team reveals the assassin.
- **Lose** if your team reveals the assassin, or reveals **3 blank tiles** over the course of the game.

## Run it locally

```
npm install
npm start
```

Open http://localhost:3000. Other devices on the same Wi-Fi can use your computer's IP address,
for example http://192.168.1.20:3000.

Run the rule tests with `npm test`.

## Put it on the internet (Azure)

The simplest route is an **Azure App Service** (Azure's managed web hosting) running the container
built from the `Dockerfile` in this repo. App Service supports WebSockets, which the game uses for
real-time updates. Using the Azure CLI:

```
az group create -n codenames-rg -l uksouth
az acr create -n <uniqueRegistryName> -g codenames-rg --sku Basic --admin-enabled true
az acr build -r <uniqueRegistryName> -t codenames:latest .
az appservice plan create -n codenames-plan -g codenames-rg --is-linux --sku B1
az webapp create -n <uniqueAppName> -g codenames-rg -p codenames-plan \
  -i <uniqueRegistryName>.azurecr.io/codenames:latest
az webapp config set -n <uniqueAppName> -g codenames-rg --web-sockets-enabled true
az webapp config appsettings set -n <uniqueAppName> -g codenames-rg --settings WEBSITES_PORT=8080
```

Then share `https://<uniqueAppName>.azurewebsites.net` with the family.

Notes:

- Game state lives in the server's memory. Restarting the app clears any games in progress,
  and you must run a **single instance** (no scale-out), otherwise players can land on different copies.
- The B1 plan costs money while it runs. Stop the app (`az webapp stop`) between game nights,
  or use the free F1 plan if you accept slower cold starts.

## Project layout

- `src/game.js` – the rules, with no networking, covered by `test/game.test.js`
- `src/server.js` – rooms, players and real-time messaging (Socket.IO)
- `public/` – the browser app (plain HTML, CSS and JavaScript, no build step)
- `src/words.js` – the word bank
