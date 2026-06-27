const express = require("express");
const router = express.Router();
const {
  createRoom,
  getRooms,
  getroomById,
  getRoomMessage,
} = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  createRoomValidator,
  roomIdValidator,
  roomMessagesValidator,
} = require("../validators/roomValidators");

router.post("/", authMiddleware, createRoomValidator, validateRequest, createRoom);
router.get("/", authMiddleware, getRooms);
router.get("/:id", authMiddleware, roomIdValidator, validateRequest, getroomById);
router.get(
  "/:id/messages",
  authMiddleware,
  roomMessagesValidator,
  validateRequest,
  getRoomMessage,
);

module.exports = router;
