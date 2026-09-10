# Prisme.ai Browser Extension

> Statut : **Preview / bêta** (v0.x). Diffusée en *unlisted* sur les stores le
> temps de la durcir. Plan de publication dans [STORE.md](STORE.md).

Extension navigateur (Chrome, Edge, Arc — Manifest V3) qui met un agent Prisme.ai
au contact de la page courante : lire la page ou la sélection pour répondre,
résumer, traduire, et — sous le contrôle de l'utilisateur — agir dans la page
(remplir un formulaire, cliquer, naviguer) via les outils de l'agent.

Le chat est le widget Prisme.ai hébergé, chargé dans le side panel (une `<iframe>`
servie par votre instance) ; l'extension en est les yeux et les mains dans le
navigateur. Aucun code distant n'est embarqué — le widget porte son propre runtime.

## Agnostique de l'instance (self-hosted)

Prisme.ai se déploie en self-hosted : chaque client fait tourner son propre
serveur. L'extension **se connecte à l'instance du client** (URL saisie au premier
lancement, puis SSO), de sorte qu'un même paquet fonctionne pour n'importe quelle
instance, quelle que soit sa version — rien n'est codé en dur.

## Installation

### Depuis le store (preview)

L'extension est publiée en **unlisted** pendant la preview. Demandez le lien store
(Chrome Web Store / Edge Add-ons) à votre contact Prisme.ai, ou chargez-la en
non empaquetée (ci-dessous).

### Chargement non empaqueté (dev / essai)

1. Ouvrir `chrome://extensions` (ou `edge://extensions`).
2. Activer le **mode développeur**.
3. **Charger l'extension non empaquetée** et sélectionner ce dossier.
4. Épingler l'extension et cliquer dessus pour ouvrir le side panel.

Pas d'étape de build — l'extension est du MV3 servi tel quel (c'est ce qui la rend
compatible store et navigateur natif).

## Configuration

Au premier lancement, le side panel affiche un court formulaire :

- **Platform URL** — la console de votre instance, ex. `https://studio.mon-entreprise.com`
- **API URL** — l'API de votre instance, ex. `https://api.mon-entreprise.com/v2`
- **Agent ID** — l'agent à qui parler
- **Avancé**
  - **Org slug** — seulement si l'org en a besoin pour l'accès anonyme
  - **Browser tools workspace** — le workspace exposant les outils côté client
    (défaut `slug:browser-mcp`) ; vider pour désactiver les actions sur la page

Platform URL et API URL sont aussi affichées dans la console sous
**Settings → Access Tokens**.

## Déploiement entreprise (managé)

Pour un déploiement de flotte, un admin peut forcer l'installation et
**préremplir la configuration** via le stockage managé (sans saisie utilisateur).
Voir [`schema.json`](schema.json) pour la forme de la policy et
[STORE.md](STORE.md#entreprise--self-hosted) pour le runbook
`ExtensionInstallForcelist`.

## Architecture

- **Side panel** (`sidepanel.*`) — héberge l'iframe du chat Prisme.ai et lui
  transmet le contexte de la page courante.
- **Content script** (`content.js`) — extrait le contenu lisible de la page et la
  sélection, et exécute les outils de l'agent (snapshot / read / click / fill /
  select / navigate ; capture d'écran via le side panel).
- **Background service worker** (`background.js`) — ouvre le side panel au clic sur
  l'icône.

L'agent tourne côté instance ; les actions passent par un modèle de permission
explicite et le token ne quitte jamais l'iframe du widget.

## Packaging

```bash
npm run check     # vérifie la syntaxe des scripts
npm run package   # produit dist/prismeai-extension-<version>.zip pour le store
```

Publication (preview = unlisted) documentée dans [STORE.md](STORE.md).

## Licence

Voir [LICENSE](LICENSE).
