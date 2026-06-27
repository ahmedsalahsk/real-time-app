const { body, param, query } = require("express-validator");

const userIdParamValidator = [
  param("userId").isMongoId().withMessage("Valid user id is required"),
];

const conversationMessagesValidator = [
  param("conversationId").isMongoId().withMessage("Valid conversation id is required"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1 to 100"),
  query("skip").optional().isInt({ min: 0 }).withMessage("Skip must be zero or greater"),
];

const sendDirectMessageValidator = [
  body("receiverId").isMongoId().withMessage("Valid receiver id is required"),
  body("text")
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Message text must be 1 to 2000 characters"),
  body("clientMessageId")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("clientMessageId cannot exceed 100 characters"),
];

module.exports = {
  userIdParamValidator,
  conversationMessagesValidator,
  sendDirectMessageValidator,
};
