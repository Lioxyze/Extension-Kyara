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

Le bouton « Mettre à jour l'extension » apparaît lorsqu'une version plus récente
est publiée sur GitHub. Un clic demande à Chrome de vérifier et d'installer la
mise à jour. Cette installation en un clic requiert une extension distribuée
par le Chrome Web Store ; une extension chargée depuis un dossier ne peut pas
être mise à jour directement par son propre bouton.

L'extension affiche sa version et indique dans le popup si elle est à jour.
Lorsqu'une nouvelle version est publiée, elle affiche un badge « MAJ » sur
l'icône et envoie une notification Chrome, au maximum une fois par version.