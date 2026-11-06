[![CI Pipeline](https://github.com/sims610/baby-name/actions/workflows/ci.yml/badge.svg)](https://github.com/sims610/baby-name/actions/workflows/ci.yml)
![Coverage](https://raw.githubusercontent.com/sims610/baby-name/badges/coverage.svg)

# Overview
This project will be a FamilySearch based baby name generator web app. It will suggest baby names to you that are unique to your ancestry.

## Features
* Generate potential baby names from your family tree.
* Front-End similar to that of swiping on a dating app.
* Ability to link your account with a spouse to see the names you both matched on.
* Page of history and meaning for each name.
* Ability to filter suggestions by boy, girl, or surprise.

## Website Mock-up

### Logo

<img src="client/public/LittleRoots_Logo.png" alt="LittleRoots Logo" width="25%">
<img src="client/public/LittleRoots_Logo_Title.png" alt="LittleRoots Logo" width="25%">

### Welcome Page

<img src="babynames.png" alt="Welcome Page" width="50%">

### Other Pages

<img src="pages.png" alt="Other Pages" width="75%">

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (includes npm)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/), to run MySQL locally

### Installation
From the project's root folder, install the dependencies:

```bash
npm install
```

This installs the dependencies for every workspace in one step, so you don't need to run it inside each folder.

### Starting the Database
Accounts and sessions are stored in MySQL 8.4, which runs in Docker. With Docker Desktop open, run this from the project's root folder:

```bash
docker compose up -d
```

The data lives in a Docker volume, so it survives restarts. Stop MySQL with `docker compose down`, or erase all its data with `docker compose down -v`. The tests need MySQL running too.

### Running the App
Start the development servers:

```bash
npm run dev
```

This starts the API server on http://localhost:3000 and the client together. Once it's running, open the local URL Vite prints in the terminal (usually http://localhost:5173). The client forwards `/api` requests to the server, and http://localhost:3000/api/docs lists the available endpoints.

To try the app without registering, log in with the demo account **test@gmail.com** / **test1234**. It comes with saved favorites, a top 3, and a linked partner, **test2@gmail.com** (same password), so Matches has names to compare.

> **Note:** Everything the app saves (accounts, favorites, partner links, settings, WikiTree sign-ins and contact messages) is stored in MySQL, so it survives restarts. Names currently come from sample family tree data rather than FamilySearch.
