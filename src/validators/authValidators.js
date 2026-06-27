const { body } = require("express-validator");

const registerValidator = [
  body("username")
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Username must be 3 to 20 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password")
    .isString()
    .isLength({ min: 6, max: 100 })
    .withMessage("Password must be 6 to 100 characters"),
  body("displayName")
    .isString()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Display name must be 3 to 30 characters"),
];

const loginValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isString().notEmpty().withMessage("Password is required"),
];

module.exports = {
  registerValidator,
  loginValidator,
};
