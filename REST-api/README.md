# Forms Clone API

A RESTful API for managing forms and user sessions, built with Express.js. This API allows users to create, update, and manage forms with multiple question types and collect responses efficiently.

## Getting Started

### Prerequisites

* Node.js (v16 or higher)
* npm (v8 or higher)

### Installation

Clone the repository:

```sh
git clone https://github.com/BrigitaKasemets/FormsCloneAPI.git
cd FormsCloneAPI
```

Install dependencies:

```sh
npm install
```

### Initialize the database

Before starting the server, initialize the database by running:

```sh
npm run init-db
```

This will create the necessary database tables and set up a test admin user:
- Email: admin@example.com
- Password: password123

### Start the server

```sh
npm run dev
```

Access the API at http://localhost:3000

## API Documentation

The API is documented using Swagger. You can access the interactive documentation at:

http://localhost:3000/api-docs/

## Authentication

The API uses JWT (JSON Web Token) Bearer authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_token>
```