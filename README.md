# ScribbleText Backend


## Introduction

This project is a Node.js backend server for a messaging website. It facilitates real-time communication between users, supporting features such as sending and receiving messages, group chats, and user presence status.

## Features

- **User Authentication:** Secure user registration and login.
- **Real-Time Messaging:** Instant messaging between users and group chats.

## Technologies Used

- **Node.js:** JavaScript runtime environment.
- **Express:** Web framework for Node.js.
- **MongoDB:** NoSQL database for data storage.
- **Socket.io:** Real-time, bidirectional communication.
- **JWT:** JSON Web Tokens for authentication.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/Sibsankar-de/scribbletext-backend.git
    cd scribbletext-backend
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

## Usage

To start the server, run:
```bash
npm start
```

## HTTP statuscode divisions

-1. 200  (Success/OK)

-2. 301 (Permanent Redirect)
-3. 302 (Temporary Redirect)
-4. 304 (Not Modified)

-5. 400 (Bad Request)
-6. 401 (Unauthorized Error)
-7. 403 (Forbidden)
-8. 404 (Not Found)

-9. 500 (Internal Server Error)
-10. 501 (Not Implemented)