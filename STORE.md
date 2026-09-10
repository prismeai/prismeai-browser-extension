# Publication — store & entreprise

L'extension est diffusée en **preview** : visibilité **Unlisted** (accessible par
lien direct, non indexée), le temps de la durcir avant un passage public.

## 1. Construire le paquet

```bash
npm run check      # syntaxe OK
npm run package    # -> dist/prismeai-extension-<version>.zip
```

Le zip ne contient que le runtime (`manifest.json`, `*.js`, `sidepanel.html`,
`schema.json`, `icons/`). Bumper `version` dans `manifest.json` **et**
`package.json` à chaque upload (le store refuse une version identique).

## 2. Chrome Web Store (preview = Unlisted)

1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → **New item** → uploader le zip.
2. **Visibility : Unlisted** (⚠️ pas Public tant qu'on est en preview).
3. Renseigner la fiche (voir §4), la politique de confidentialité (§5) et les justifications de permissions (§6).
4. Soumettre à review. Une fois approuvé, partager le **lien direct** aux testeurs.

## 3. Microsoft Edge Add-ons (preview)

1. [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge) → nouvelle extension → uploader le même zip.
2. Visibilité **Hidden/Unlisted** (installation par lien uniquement).
3. Mêmes fiche / confidentialité / justifications.

## 4. Fiche (métadonnées)

- **Nom** : Prisme.ai
- **Description courte** (≤132) : « Chat with a Prisme.ai agent that knows the page you're on — summarize, translate, and act on the page. »
- **Catégorie** : Productivity
- **Langues** : en, fr
- **Single purpose** : « Provide an in-browser side-panel chat with the user's own
  Prisme.ai agent, aware of the current page, able to act on it under explicit
  user control. »
- **Captures d'écran** (1280×800 ou 640×400) : side panel ouvert sur une page,
  exemple d'action (snapshot/clic), formulaire de configuration.

## 5. Confidentialité (obligatoire pour la review)

- URL de politique de confidentialité requise → voir [PRIVACY.md](PRIVACY.md)
  (à héberger sur une page publique et coller l'URL dans la fiche).
- Déclaration d'usage des données : le contenu de la page / la sélection sont
  envoyés **à l'instance Prisme.ai du client** (URL saisie par l'utilisateur) pour
  répondre. Pas de vente de données, pas d'usage hors du service.

## 6. Justification des permissions (à copier dans la fiche)

| Permission | Justification |
|---|---|
| `sidePanel` | Afficher le chat dans le panneau latéral. |
| `storage` | Mémoriser la configuration (URL instance, agent) localement / via policy managée. |
| `tabs` | Connaître l'onglet actif pour lui transmettre le contexte de page. |
| `scripting` | Injecter le content script à la demande sur l'onglet actif quand il n'y est pas déjà (exécution d'un outil). |
| `host_permissions: <all_urls>` | Lire le contenu de la page et exécuter les actions demandées, sur le site que l'utilisateur consulte. |
| Remote code | **Aucun** — tout le code est dans le paquet ; le chat est une iframe hébergée par l'instance. |

## Entreprise / self-hosted

Déploiement de flotte sans saisie utilisateur :

1. **Force-install** via policy navigateur — `ExtensionInstallForcelist`
   (Chrome/Edge, GPO / MDM / registre) avec l'ID de l'extension + l'URL de mise à
   jour du store.
2. **Configuration managée** — pousser les valeurs via `chrome.storage.managed`
   selon [`schema.json`](schema.json) (Platform URL, API URL, Agent ID, org slug,
   tools workspace). L'extension lit d'abord la policy managée, puis retombe sur la
   config utilisateur si absente.

Exemple de policy managée (JSON) :

```json
{
  "instance": "https://studio.mon-entreprise.com",
  "api": "https://api.mon-entreprise.com/v2",
  "agent": "agent_xxxxxxxx",
  "org": "mon-org",
  "toolsWorkspace": "slug:browser-mcp"
}
```
