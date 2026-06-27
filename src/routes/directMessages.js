const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  getConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendDirectMessage,
} = require("../controllers/directMessageController");
const {
  userIdParamValidator,
  conversationMessagesValidator,
  sendDirectMessageValidator,
} = require("../validators/directMessageValidators");

router.use(authMiddleware);

router.get("/conversations", getConversations);
router.get(
  "/conversations/with/:userId",
  userIdParamValidator,
  validateRequest,
  getOrCreateConversation,
);
router.get(
  "/conversations/:conversationId/messages",
  conversationMessagesValidator,
  validateRequest,
  getConversationMessages,
);
router.post(
  "/messages",
  sendDirectMessageValidator,
  validateRequest,
  sendDirectMessage,
);

module.exports = router;
