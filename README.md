# Comics Tracker Extract

Comics Tracker Extract est le backend d'extraction et de diffusion d'images pour le projet [Comics Tracker](https://github.com/YanisHlali/comics-tracker).

Il permet d'extraire, convertir et servir les images contenues dans des archives de bandes dessinées (CBR, CBZ, etc.) via une API web, utilisées par l'application principale Comics Tracker pour la lecture en ligne.

## Rôle dans Comics Tracker

Ce service Node.js fonctionne comme un microservice indépendant : il reçoit des archives, extrait les images, les convertit si besoin, et les rend accessibles via des routes API sécurisées. L'application Next.js (frontend) consomme ces images pour afficher les comics dans le lecteur intégré.

## Fonctionnalités principales

- **Upload** de fichiers CBR/CBZ (et autres archives supportées)
- **Extraction** automatique des images dans un dossier dédié
- **Conversion** des images TIFF/BMP en JPEG pour une compatibilité maximale
- **Accès web** aux images extraites via des routes API sécurisées
- **Nettoyage automatique** des fichiers inutilisés pour économiser l'espace disque
- **Suivi d'accès** pour optimiser la gestion des ressources

## Installation

```bash
npm install
```

## Lancement du serveur

```bash
npm start
```

Le serveur démarre par défaut sur le port 4000.

## Utilisation

- Envoyez une archive CBR/CBZ via l'API (voir la documentation de l'endpoint d'upload dans le frontend ou dans `lib/routes.js`)
- Récupérez les images extraites via l'URL :
  ```
  GET /cbr/:id/:image
  ```
- Les images sont servies avec le bon type MIME et un cache long terme.

## Configuration

- Les fichiers extraits sont stockés dans le dossier `public/`
- Les fichiers uploadés sont stockés dans le dossier `uploads/`
- Les accès sont suivis pour permettre le nettoyage automatique

## Dépendances principales
- express
- multer
- cors
- node-fetch
- node-html-parser

## Licence

ISC