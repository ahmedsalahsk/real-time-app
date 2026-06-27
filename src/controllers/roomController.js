const Room = require("../models/Room");
const Message = require("../models/Message");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sanitizeText } = require("../utils/sanitize");

// create Room
const createRoom = catchAsync(async (req, res) => {
  const { isPrivate } = req.body;
  const name = sanitizeText(req.body.name);
  const description = sanitizeText(req.body.description);

  const room = await Room.create({
    name,
    description,
    isPrivate: isPrivate === true,
    createdBy: req.user._id,
    members: [req.user._id],
  });

  const populated = await Room.findById(room._id).populate(
    "createdBy",
    "username displayName",
  );

  res.status(201).json(populated);
});

//  Get Rooms
const getRooms = catchAsync(async (req, res) => {
  const rooms = await Room.find()
    .populate("createdBy", "username displayName")
    .sort({ createdAt: -1 })
    .lean();

  res.json(rooms);
});

// Get Room by ID
const getroomById = catchAsync(async (req, res, next) => {
  const room = await Room.findById(req.params.id)
    .populate("createdBy", "username displayName")
    .lean();

  if (!room) {
    return next(new AppError("Room not found", 404, "Not Found"));
  }

  if (room.isPrivate && !room.members.some((id) => id.toString() === req.user._id.toString())) {
    return next(new AppError("You are not allowed to access this room", 403, "Authorization Error"));
  }

  res.json(room);
});

// getRoomMessage
const getRoomMessage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = parseInt(req.query.skip, 10) || 0;
  const room = await Room.findById(id).lean();

  if (!room) {
    return next(new AppError("Room not found", 404, "Not Found"));
  }

  if (room.isPrivate && !room.members.some((member) => member.toString() === req.user._id.toString())) {
    return next(new AppError("You are not allowed to access this room", 403, "Authorization Error"));
  }

  const messages = await Message.find({ room: id })
    .sort({ createdAt: -1 })
    .populate("user", "username displayName")
    .skip(skip)
    .limit(limit)
    .lean();

  res.json(messages);
});

module.exports = {
  createRoom,
  getRooms,
  getroomById,
  getRoomMessage,
};
