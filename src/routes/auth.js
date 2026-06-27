const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authControllers");
const validateRequest = require("../middleware/validateRequest");
const { registerValidator, loginValidator } = require("../validators/authValidators");

router.post("/register", registerValidator, validateRequest, register);

router.post("/login", loginValidator, validateRequest, login);

module.exports = router;
