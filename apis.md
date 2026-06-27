# Real-Time Chat App API Documentation

## Architecture Overview

The project is a CommonJS Node.js app using Express, Mongoose, MongoDB, JWT authentication, and Socket.IO.

Folder structure:

- `src/index.js` - app bootstrap, MongoDB connection, middleware, routes, Socket.IO initialization.
- `src/models/` - Mongoose models for users, rooms, conversations, and messages.
- `src/controllers/` - REST request handlers.
- `src/routes/` - Express route definitions.
- `src/middleware/` - authentication, validation, rate limiting, not found, and global error handling.
- `src/validators/` - reusable `express-validator` validation chains.
- `src/socket/` - Socket.IO authentication and event handlers.
- `frontend/` - React browser client.

## Authentication Flow

1. Register with `POST /api/auth/register`.
2. Login with `POST /api/auth/login`.
3. Store the returned JWT.
4. Send REST requests with `Authorization: Bearer <token>`.
5. Connect Socket.IO with either `auth: { token }` or `?token=<token>`.

JWTs default to a 2 hour lifetime unless `JWT_EXPIRES_IN` is configured.

## Error Format

All handled REST errors use:

```json
{
  "success": false,
  "message": "Validation message",
  "error": "Validation Error",
  "statusCode": 400
}
```

In production, unexpected server errors hide internal details.

## Headers

Authenticated endpoints require:

```http
Authorization: Bearer <jwt>
Content-Type: application/json
```

## REST APIs

### GET /

Description: Basic server check.
Authentication Required: No

Success Response:

```text
Hello World!
```

### GET /health

Description: Health check.
Authentication Required: No

Success Response:

```json
{ "status": "ok" }
```

### POST /api/auth/register

Description: Create a user account.
Authentication Required: No

Request Body:

```json
{
  "username": "ahmed",
  "email": "ahmed@example.com",
  "password": "secret123",
  "displayName": "Ahmed Salah"
}
```

Success Response: `201 Created`

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "_id": "userId",
    "username": "ahmed",
    "email": "ahmed@example.com",
    "displayName": "Ahmed Salah",
    "avatar": "",
    "createdAt": "2026-06-27T00:00:00.000Z",
    "updatedAt": "2026-06-27T00:00:00.000Z"
  }
}
```

Error Responses: `400` validation error, `409` duplicate username/email.

Example Request:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"ahmed\",\"email\":\"ahmed@example.com\",\"password\":\"secret123\",\"displayName\":\"Ahmed Salah\"}"
```

Notes: Passwords are hashed before storage and are never returned.

### POST /api/auth/login

Description: Authenticate a user and return a JWT.
Authentication Required: No

Request Body:

```json
{
  "email": "ahmed@example.com",
  "password": "secret123"
}
```

Success Response: `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "userId",
    "username": "ahmed",
    "email": "ahmed@example.com",
    "displayName": "Ahmed Salah",
    "avatar": ""
  },
  "token": "jwt"
}
```

Error Responses: `400` validation error, `401` invalid credentials.

### POST /api/rooms

Description: Create a public or private room. The creator is automatically added as a member.
Authentication Required: Yes

Request Body:

```json
{
  "name": "General",
  "description": "Team chat",
  "isPrivate": false
}
```

Success Response: `201 Created`

```json
{
  "_id": "roomId",
  "name": "General",
  "description": "Team chat",
  "isPrivate": false,
  "members": ["userId"],
  "createdBy": {
    "_id": "userId",
    "username": "ahmed",
    "displayName": "Ahmed Salah"
  },
  "createdAt": "2026-06-27T00:00:00.000Z",
  "updatedAt": "2026-06-27T00:00:00.000Z"
}
```

Error Responses: `400` validation error, `401` missing/invalid token.

### GET /api/rooms

Description: List rooms.
Authentication Required: Yes

Success Response: `200 OK`

```json
[
  {
    "_id": "roomId",
    "name": "General",
    "description": "",
    "isPrivate": false,
    "createdBy": {
      "_id": "userId",
      "username": "ahmed",
      "displayName": "Ahmed Salah"
    }
  }
]
```

### GET /api/rooms/:id

Description: Get a room by id.
Authentication Required: Yes

URL Params:

- `id` - MongoDB room id.

Success Response: `200 OK`

```json
{
  "_id": "roomId",
  "name": "General",
  "description": "",
  "isPrivate": false,
  "members": ["userId"]
}
```

Error Responses: `400` invalid id, `403` private room access denied, `404` room not found.

### GET /api/rooms/:id/messages

Description: Load room message history.
Authentication Required: Yes

URL Params:

- `id` - MongoDB room id.

Query Params:

- `limit` - Optional integer, 1 to 100, default `50`.
- `skip` - Optional integer, default `0`.

Success Response: `200 OK`

```json
[
  {
    "_id": "messageId",
    "room": "roomId",
    "user": {
      "_id": "userId",
      "username": "ahmed",
      "displayName": "Ahmed Salah"
    },
    "text": "Hello",
    "createdAt": "2026-06-27T00:00:00.000Z"
  }
]
```

Notes: Results are newest first. Reverse on the client if needed for chronological display.

### GET /api/users

Description: Search users for direct messages.
Authentication Required: Yes

Query Params:

- `search` - Optional username, display name, or email fragment.
- `limit` - Optional integer, 1 to 50, default `20`.

Success Response:

```json
[
  {
    "_id": "userId",
    "username": "mona",
    "displayName": "Mona",
    "avatar": ""
  }
]
```

Notes: The current user is excluded.

### GET /api/dm/conversations

Description: List the authenticated user's direct-message conversations.
Authentication Required: Yes

Success Response:

```json
[
  {
    "_id": "conversationId",
    "participants": [
      { "_id": "userId1", "username": "ahmed", "displayName": "Ahmed Salah", "avatar": "" },
      { "_id": "userId2", "username": "mona", "displayName": "Mona", "avatar": "" }
    ],
    "participantKey": "sortedUserId1:sortedUserId2",
    "lastMessage": {
      "_id": "messageId",
      "text": "Hello",
      "user": { "_id": "userId1", "username": "ahmed", "displayName": "Ahmed Salah" },
      "receiver": { "_id": "userId2", "username": "mona", "displayName": "Mona" }
    },
    "lastMessageAt": "2026-06-27T00:00:00.000Z"
  }
]
```

### GET /api/dm/conversations/with/:userId

Description: Get or automatically create the one-to-one conversation with another user.
Authentication Required: Yes

URL Params:

- `userId` - Other user's id.

Success Response:

```json
{
  "_id": "conversationId",
  "participants": [
    { "_id": "userId1", "username": "ahmed", "displayName": "Ahmed Salah", "avatar": "" },
    { "_id": "userId2", "username": "mona", "displayName": "Mona", "avatar": "" }
  ],
  "participantKey": "sortedUserId1:sortedUserId2"
}
```

Error Responses: `400` self conversation or invalid id, `404` user not found.

Notes: Duplicate conversations are prevented by a unique `participantKey`.

### GET /api/dm/conversations/:conversationId/messages

Description: Load direct-message history.
Authentication Required: Yes

URL Params:

- `conversationId` - Conversation id.

Query Params:

- `limit` - Optional integer, 1 to 100, default `50`.
- `skip` - Optional integer, default `0`.

Success Response:

```json
[
  {
    "_id": "messageId",
    "conversation": "conversationId",
    "user": { "_id": "senderId", "username": "ahmed", "displayName": "Ahmed Salah", "avatar": "" },
    "receiver": { "_id": "receiverId", "username": "mona", "displayName": "Mona", "avatar": "" },
    "text": "Hello",
    "createdAt": "2026-06-27T00:00:00.000Z"
  }
]
```

Error Responses: `400` invalid id/query, `403` not a participant, `404` conversation not found.

### POST /api/dm/messages

Description: Send a direct message over REST. Socket delivery is also emitted to online sender/receiver.
Authentication Required: Yes

Request Body:

```json
{
  "receiverId": "receiverUserId",
  "text": "Hello",
  "clientMessageId": "optional-client-generated-id"
}
```

Success Response: `201 Created`

```json
{
  "message": {
    "_id": "messageId",
    "conversation": "conversationId",
    "user": { "_id": "senderId", "username": "ahmed", "displayName": "Ahmed Salah", "avatar": "" },
    "receiver": { "_id": "receiverId", "username": "mona", "displayName": "Mona", "avatar": "" },
    "text": "Hello",
    "createdAt": "2026-06-27T00:00:00.000Z"
  },
  "conversationId": "conversationId"
}
```

Error Responses: `400` validation/self-message, `404` receiver not found, `409` duplicate client message id.

## Socket.IO Connection Flow

Connect to the server:

```js
const socket = io("http://localhost:3000", {
  auth: { token },
  query: { token }
});
```

On success, the socket joins `user:<userId>` internally and receives `online-users`.

Socket error payload:

```json
{
  "success": false,
  "message": "Valid roomId is required",
  "error": "Valid roomId is required",
  "statusCode": 400,
  "event": "join-room"
}
```

## Presence Events

### online-users

Server to client after connect.

```json
[{ "userId": "userId" }]
```

### user-online

Server to all clients when a user becomes online.

```json
{ "userId": "userId", "username": "ahmed", "displayName": "Ahmed Salah" }
```

### user-offline

Server to all clients when the user's last socket disconnects.

```json
{ "userId": "userId" }
```

## Room Events

### join-room

Client to server:

```json
{ "roomId": "roomId" }
```

Server replies with `joined-room`:

```json
{ "roomId": "roomId" }
```

### leave-room

Client to server:

```json
{ "roomId": "roomId" }
```

Server replies with `left-room`.

### send-message

Client to server:

```json
{
  "roomId": "roomId",
  "text": "Hello room",
  "clientMessageId": "optional-client-id"
}
```

Server emits `new-message` to the room:

```json
{
  "_id": "messageId",
  "room": "roomId",
  "user": { "_id": "userId", "username": "ahmed", "displayName": "Ahmed Salah", "avatar": "" },
  "text": "Hello room",
  "createdAt": "2026-06-27T00:00:00.000Z"
}
```

### typing-start / typing-stop

Client to server:

```json
{ "roomId": "roomId" }
```

Server emits `user-typing` or `user-typing-stopped` to other room members.

## Direct Message Events

### dm:send

Client to server:

```json
{
  "receiverId": "receiverUserId",
  "text": "Private hello",
  "clientMessageId": "optional-client-id"
}
```

Server emits `dm:new-message` to sender and receiver:

```json
{
  "_id": "messageId",
  "conversation": "conversationId",
  "user": { "_id": "senderId", "username": "ahmed", "displayName": "Ahmed Salah", "avatar": "" },
  "receiver": { "_id": "receiverId", "username": "mona", "displayName": "Mona", "avatar": "" },
  "text": "Private hello",
  "createdAt": "2026-06-27T00:00:00.000Z"
}
```

Server also emits `dm:sent` to the sender:

```json
{
  "conversationId": "conversationId",
  "message": {}
}
```

### dm:typing-start / dm:typing-stop

Client to server:

```json
{
  "receiverId": "receiverUserId",
  "conversationId": "conversationId"
}
```

Server emits `dm:user-typing` or `dm:user-typing-stopped` to the receiver.

## Security Notes

- REST endpoints require JWT where appropriate.
- Socket.IO authenticates the token before registering listeners.
- Private room reads and joins require membership.
- Direct-message history requires conversation participation.
- Direct conversations are unique per two sorted participant ids.
- Text inputs are trimmed and stripped of control characters.
- Request bodies, params, and queries are validated with `express-validator`.
- Basic IP rate limiting protects REST routes.
- Basic per-user socket send throttling protects chat events.
- Duplicate messages can be rejected with `clientMessageId`.
