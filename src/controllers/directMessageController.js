const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sanitizeText } = require("../utils/sanitize");

const buildParticipantKey = (userId, otherUserId) =>
  [userId.toString(), otherUserId.toString()].sort().join(":");

const populateConversation = (query) =>
  query
    .populate("participants", "username displayName avatar")
    .populate({
      path: "lastMessage",
      populate: [
        { path: "user", select: "username displayName avatar" },
        { path: "receiver", select: "username displayName avatar" },
      ],
    });

const findOrCreateConversation = async (userId, otherUserId) => {
  const participantKey = buildParticipantKey(userId, otherUserId);

  let conversation = await Conversation.findOne({ participantKey });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [userId, otherUserId],
      participantKey,
    });
  }

  return conversation;
};

const assertParticipant = (conversation, userId) =>
  conversation.participants.some((participant) => participant.toString() === userId.toString());

const getConversations = catchAsync(async (req, res) => {
  const conversations = await populateConversation(
    Conversation.find({ participants: req.user._id }).sort({ lastMessageAt: -1, updatedAt: -1 }),
  ).lean();

  res.json(conversations);
});

const getOrCreateConversation = catchAsync(async (req, res, next) => {
 

  const { userId } = req.params;

  if (userId === req.user._id.toString()) {
    return next(new AppError("Cannot create a conversation with yourself", 400, "Validation Error"));
  }


  const otherUser = await User.findById(userId).select("_id");
  if (!otherUser) {
    return next(new AppError("User not found", 404, "Not Found"));
  }


  const conversation = await findOrCreateConversation(req.user._id, otherUser._id);
 

  const populated = await populateConversation(Conversation.findById(conversation._id)).lean();

  res.status(200).json(populated);
});

const getConversationMessages = catchAsync(async (req, res, next) => {
  const { conversationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = parseInt(req.query.skip, 10) || 0;

  const conversation = await Conversation.findById(conversationId).lean();

  if (!conversation) {
    return next(new AppError("Conversation not found", 404, "Not Found"));
  }

  if (!assertParticipant(conversation, req.user._id)) {
    return next(new AppError("You are not allowed to access this conversation", 403, "Authorization Error"));
  }

  const messages = await Message.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .populate("user", "username displayName avatar")
    .populate("receiver", "username displayName avatar")
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(messages);
});

const sendDirectMessage = catchAsync(async (req, res, next) => {
  const { receiverId, clientMessageId } = req.body;
  const text = sanitizeText(req.body.text);

  if (receiverId === req.user._id.toString()) {
    return next(new AppError("Cannot send a message to yourself", 400, "Validation Error"));
  }

  const receiver = await User.findById(receiverId).select("_id username displayName avatar");
  if (!receiver) {
    return next(new AppError("Receiver not found", 404, "Not Found"));
  }

  const conversation = await findOrCreateConversation(req.user._id, receiver._id);
  const message = await Message.create({
    conversation: conversation._id,
    user: req.user._id,
    receiver: receiver._id,
    text,
    clientMessageId: clientMessageId || null,
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  const populated = await Message.findById(message._id)
    .populate("user", "username displayName avatar")
    .populate("receiver", "username displayName avatar")
    .lean();

  const io = req.app.get("io");
  if (io) {
    io.to(`user:${receiver._id}`).emit("dm:new-message", populated);
    io.to(`user:${req.user._id}`).emit("dm:new-message", populated);
  }

  res.status(201).json({
    message: populated,
    conversationId: conversation._id,
  });
});

module.exports = {
  getConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendDirectMessage,
  findOrCreateConversation,
};
