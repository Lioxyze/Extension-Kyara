# Kyara Booster Helper

Extension Chrome Manifest V3 qui repère les boosters gratuits sur Kyara et
automatise leur ouverture, y compris les étapes de révélation et de retour à
la liste des boosters. Si Kyara propose une commande d'ouverture multiple,
l'assistant la privilégie ; sinon il ouvre les boosters gratuits un par un.
Les ouvertures payantes ne sont pas déclenchées volontairement.

L'extension propose également des outils facultatifs pour gérer la vente des
doubles et fonctionne avec Kyara dans un onglet en arrière-plan.

## Installation depuis les sources

1. Télécharge ou clone ce dépôt.
2. Ouvre `chrome://extensions` dans Chrome et active le mode développeur.
3. Clique sur « Charger l'extension non empaquetée » et sélectionne le dossier
   de l'extension.

## Mises à jour

La publication des sources sur GitHub ne met pas automatiquement à jour une
extension Chrome. Pour une installation non empaquetée, récupère les nouveaux
fichiers puis clique sur « Recharger » dans `chrome://extensions`. Le bouton
« Mettre à jour l'extension » vérifie les mises à jour gérées par Chrome ; les
mises à jour automatiques nécessitent une distribution compatible, par exemple
le Chrome Web Store.