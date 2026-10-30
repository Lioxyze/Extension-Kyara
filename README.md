# Kyara Booster Helper

Extension Chrome Manifest V3 qui repère les boosters gratuits sur Kyara et
automatise leur ouverture, y compris les étapes de révélation et de retour à
la liste des boosters. L'assistant privilégie les lots gratuits disponibles :
10 boosters, puis 5, puis un par un lorsqu'aucun lot n'est proposé. Les
ouvertures payantes ne sont pas déclenchées volontairement.

L'extension propose également des outils facultatifs pour gérer la vente des
doubles et fonctionne avec Kyara dans un onglet en arrière-plan.

## Installation depuis les sources

1. Télécharge ou clone ce dépôt.
2. Ouvre `chrome://extensions` dans Chrome et active le mode développeur.
3. Clique sur « Charger l'extension non empaquetée » et sélectionne le dossier
   de l'extension.

## Mises à jour

Pour activer les mises à jour automatiques sous Windows, exécute une fois
`installer.ps1` depuis le dossier exact déjà chargé dans `chrome://extensions` :

```powershell
powershell -ExecutionPolicy Bypass -File .\installer.ps1
```

Le programme vérifie GitHub à l'ouverture de session et toutes les trois
heures, puis remplace les fichiers dans ce même dossier. Le popup affiche
toujours la version installée. Une fois les nouveaux fichiers préparés, le
bouton « Mettre à jour maintenant » apparaît ; clique dessus pour recharger
l'extension et l'onglet Kyara. Le bouton disparaît alors et la nouvelle version
est affichée à la prochaine ouverture du popup. Les réglages sont conservés
puisque le dossier et l'identifiant de l'extension ne changent pas.

Le popup indique aussi la version installée et signale les versions en attente.
Une notification Chrome et un badge « MAJ » apparaissent à la publication
d'une nouvelle version.