const { body, param, query } = require("express-validator");

const createRoomValidator = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Room name must be 3 to 50 characters"),
  body("description")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description cannot exceed 200 characters"),
  body("isPrivate").optional().isBoolean().withMessage("isPrivate must be boolean"),
];

const roomIdValidator = [
  param("id").isMongoId().withMessage("Valid room id is required"),
];

const roomMessagesValidator = [
  param("id").isMongoId().withMessage("Valid room id is required"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1 to 100"),
  query("skip").optional().isInt({ min: 0 }).withMessage("Skip must be zero or greater"),
];

module.exports = {
  createRoomValidator,
  roomIdValidator,
  roomMessagesValidator,
};
