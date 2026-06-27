const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { searchUsers } = require("../controllers/userController");
const { searchUsersValidator } = require("../validators/userValidators");

router.get("/", authMiddleware, searchUsersValidator, validateRequest, searchUsers);

module.exports = router;
