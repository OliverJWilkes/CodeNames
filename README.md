# Family Codenames

A word-linking game for two teams, playable in any web browser on phones, tablets and PCs.
Everyone joins the same room with a four-letter code; the server keeps the game in sync in real time.

## How to play

- 25 words sit in a 5 x 5 grid. Secretly, 9 are red, 9 are blue, 6 are blank, and 1 is the **assassin**.
- Each team has a **teller** and a **guesser**. The teller sees the colours; the guesser does not.
  Each of the four seats can be held by only one person.
- The starting team is chosen at random.
- On your turn the teller types a **one-word clue** and a **number** (how many words it links to).
  The clue cannot be a word on the board.
- The guesser taps words and gets exactly that many guesses. A correct colour lets them keep going
  until the guesses run out.
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

Quickest route: an **Azure App Service** (Azure's managed web hosting). You need the
[Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed, then:

```
az login
./deploy.sh <unique-app-name>
```

The name must be unique across all of Azure (for example `wilkes-codenames`). The script creates
a resource group, an App Service plan and the web app, then uploads the code.
Share `https://<unique-app-name>.azurewebsites.net` with the family.

It defaults to the **F1 free tier**, which needs no VM quota and so works on a new Azure trial
subscription. F1 does not offer WebSockets, so the game falls back to HTTP long-polling; updates
still arrive within a second, which is fine for a family game. On a pay-as-you-go subscription you
can pass a region and tier for a faster, always-on app with WebSockets enabled:

```
./deploy.sh <unique-app-name> uksouth B1
```

If a region reports that it is not accepting new customers, try another, such as `northeurope`,
`swedencentral` or `eastus`.

If you prefer containers, the `Dockerfile` in this repo also works on App Service or Container Apps.

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
