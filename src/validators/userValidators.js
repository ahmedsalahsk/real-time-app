const { query } = require("express-validator");

const searchUsersValidator = [
  query("search")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Search cannot exceed 50 characters"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be 1 to 50"),
];

module.exports = {
  searchUsersValidator,
};
