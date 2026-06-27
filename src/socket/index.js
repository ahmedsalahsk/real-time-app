const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Room = require("../models/Room");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { findOrCreateConversation } = require("../controllers/directMessageController");
const { sanitizeText } = require("../utils/sanitize");

const onlineUsers = new Map();
const sendBuckets = new Map();

const emitSocketError = (socket, message, statusCode = 400, event = null) => {
  socket.emit("socket-error", {
    success: false,
    message,
    error: message,
    statusCode,
    event,
  });
};

const isMongoId = (value) => /^[a-f\d]{24}$/i.test(value || "");

const canSend = (userId) => {
  const now = Date.now();
  const windowMs = 10 * 1000;
  const max = 12;
  const bucket = sendBuckets.get(userId);

  if (!bucket || bucket.resetAt <= now) {
    sendBuckets.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
};

const addOnlineUser = (userId, socketId) => {
  const sockets = onlineUsers.get(userId) || new Set();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
  return sockets.size === 1;
};

const removeOnlineUser = (userId, socketId) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    sendBuckets.delete(userId);
    return true;
  }

  return false;
};

const getOnlineUsers = () =>
  Array.from(onlineUsers.keys()).map((userId) => ({ userId }));

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.data.userId = user._id.toString();
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error("Authentication error: Invalid token"));
  }
};

const ensureRoomAccess = async (roomId, userId) => {
  const room = await Room.findById(roomId).lean();

  if (!room) {
    return { error: "Room not found", statusCode: 404 };
  }

  const isMember = room.members?.some((member) => member.toString() === userId);

  if (room.isPrivate && !isMember) {
    return {
      error: "You are not a member of this private room",
      statusCode: 403,
    };
  }

  return { room };
};

const registerRoomEvents = (io, socket) => {
  socket.on("join-room", async (data = {}) => {
    try {
      const roomId = data.roomId;

      if (!isMongoId(roomId)) {
        return emitSocketError(socket, "Valid roomId is required", 400, "join-room");
      }

      const access = await ensureRoomAccess(roomId, socket.data.userId);
      if (access.error) {
        return emitSocketError(socket, access.error, access.statusCode, "join-room");
      }

      await socket.join(`room:${roomId}`);
      socket.emit("joined-room", { roomId });
    } catch (error) {
      emitSocketError(socket, "Failed to join room", 500, "join-room");
    }
  });

  socket.on("leave-room", async (data = {}) => {
    const roomId = data.roomId;

    if (!isMongoId(roomId)) {
      return emitSocketError(socket, "Valid roomId is required", 400, "leave-room");
    }

    await socket.leave(`room:${roomId}`);
    socket.emit("left-room", { roomId });
  });

  socket.on("send-message", async (data = {}) => {
    try {
      const roomId = data.roomId;
      const text = sanitizeText(data.text);
      const clientMessageId = sanitizeText(data.clientMessageId) || null;

      if (!isMongoId(roomId) || !text) {
        return emitSocketError(socket, "Valid roomId and text are required", 400, "send-message");
      }

      if (text.length > 2000) {
        return emitSocketError(socket, "Message text cannot exceed 2000 characters", 400, "send-message");
      }

      if (!canSend(socket.data.userId)) {
        return emitSocketError(socket, "You are sending messages too quickly", 429, "send-message");
      }

      const access = await ensureRoomAccess(roomId, socket.data.userId);
      if (access.error) {
        return emitSocketError(socket, access.error, access.statusCode, "send-message");
      }

      const message = await Message.create({
        room: roomId,
        user: socket.data.userId,
        text,
        clientMessageId,
      });
      const populated = await Message.findById(message._id)
        .populate("user", "username displayName avatar")
        .lean();

      io.to(`room:${roomId}`).emit("new-message", populated);
    } catch (error) {
      const message = error.code === 11000 ? "Duplicate message ignored" : "Failed to send message";
      emitSocketError(socket, message, error.code === 11000 ? 409 : 500, "send-message");
    }
  });

  socket.on("typing-start", async (data = {}) => {
    const roomId = data.roomId;

    if (!isMongoId(roomId)) {
      return emitSocketError(socket, "Valid roomId is required", 400, "typing-start");
    }

    socket.to(`room:${roomId}`).emit("user-typing", {
      roomId,
      userId: socket.data.userId,
      username: socket.data.user.username,
    });
  });

  socket.on("typing-stop", async (data = {}) => {
    const roomId = data.roomId;

    if (!isMongoId(roomId)) {
      return emitSocketError(socket, "Valid roomId is required", 400, "typing-stop");
    }

    socket.to(`room:${roomId}`).emit("user-typing-stopped", {
      roomId,
      userId: socket.data.userId,
      username: socket.data.user.username,
    });
  });
};

const registerDirectMessageEvents = (io, socket) => {
  socket.on("dm:send", async (data = {}) => {
    try {
      const receiverId = data.receiverId;
      const text = sanitizeText(data.text);
      const clientMessageId = sanitizeText(data.clientMessageId) || null;

      if (!isMongoId(receiverId) || !text) {
        return emitSocketError(socket, "Valid receiverId and text are required", 400, "dm:send");
      }

      if (receiverId === socket.data.userId) {
        return emitSocketError(socket, "Cannot send a message to yourself", 400, "dm:send");
      }

      if (text.length > 2000) {
        return emitSocketError(socket, "Message text cannot exceed 2000 characters", 400, "dm:send");
      }

      if (!canSend(socket.data.userId)) {
        return emitSocketError(socket, "You are sending messages too quickly", 429, "dm:send");
      }

      const receiver = await User.findById(receiverId).select("_id");
      if (!receiver) {
        return emitSocketError(socket, "Receiver not found", 404, "dm:send");
      }

      const conversation = await findOrCreateConversation(socket.data.userId, receiverId);
      const message = await Message.create({
        conversation: conversation._id,
        user: socket.data.userId,
        receiver: receiverId,
        text,
        clientMessageId,
      });

      await Conversation.findByIdAndUpdate(conversation._id, {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
      });

      const populated = await Message.findById(message._id)
        .populate("user", "username displayName avatar")
        .populate("receiver", "username displayName avatar")
        .lean();

      io.to(`user:${receiverId}`).emit("dm:new-message", populated);
      io.to(`user:${socket.data.userId}`).emit("dm:new-message", populated);
      socket.emit("dm:sent", {
        conversationId: conversation._id,
        message: populated,
      });
    } catch (error) {
      const message = error.code === 11000 ? "Duplicate message ignored" : "Failed to send direct message";
      emitSocketError(socket, message, error.code === 11000 ? 409 : 500, "dm:send");
    }
  });

  socket.on("dm:typing-start", async (data = {}) => {
    const receiverId = data.receiverId;
    const conversationId = data.conversationId;

    if (!isMongoId(receiverId) || !isMongoId(conversationId)) {
      return emitSocketError(socket, "Valid receiverId and conversationId are required", 400, "dm:typing-start");
    }

    socket.to(`user:${receiverId}`).emit("dm:user-typing", {
      conversationId,
      userId: socket.data.userId,
      username: socket.data.user.username,
    });
  });

  socket.on("dm:typing-stop", async (data = {}) => {
    const receiverId = data.receiverId;
    const conversationId = data.conversationId;

    if (!isMongoId(receiverId) || !isMongoId(conversationId)) {
      return emitSocketError(socket, "Valid receiverId and conversationId are required", 400, "dm:typing-stop");
    }

    socket.to(`user:${receiverId}`).emit("dm:user-typing-stopped", {
      conversationId,
      userId: socket.data.userId,
      username: socket.data.user.username,
    });
  });
};

const initializeSocket = (io) => {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    const user = socket.data.user;
    const becameOnline = addOnlineUser(userId, socket.id);

    socket.join(`user:${userId}`);
    socket.emit("online-users", getOnlineUsers());

    if (becameOnline) {
      io.emit("user-online", {
        userId,
        username: user.username,
        displayName: user.displayName,
      });
    }

    registerRoomEvents(io, socket);
    registerDirectMessageEvents(io, socket);

    socket.on("disconnect", () => {
      const becameOffline = removeOnlineUser(userId, socket.id);

      if (becameOffline) {
        io.emit("user-offline", { userId });
      }
    });
  });
};

module.exports = {
  initializeSocket,
  onlineUsers,
};
