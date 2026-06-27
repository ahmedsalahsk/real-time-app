const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { successResponse } = require("../utils/response");
const { sanitizeText } = require("../utils/sanitize");

const buildUserResponse = (user) => {
  const userObject = user.toObject();
  delete userObject.password;
  return userObject;
};

// @desc Register a new user
const register = catchAsync(async (req, res, next) => {
  const { password } = req.body;
  const username = sanitizeText(req.body.username);
  const email = sanitizeText(req.body.email).toLowerCase();
  const displayName = sanitizeText(req.body.displayName);

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    return next(new AppError("Username or email already exists", 409, "Duplicate Value"));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    username,
    email,
    password: hashedPassword,
    displayName,
  });

  successResponse(res, 201, "User registered successfully", {
    user: buildUserResponse(newUser),
  });
});

// @desc Login a user
const login = catchAsync(async (req, res, next) => {
  const { password } = req.body;
  const email = sanitizeText(req.body.email).toLowerCase();

  const foundUser = await User.findOne({ email });

  if (!foundUser) {
    return next(new AppError("Invalid email or password", 401, "Authentication Error"));
  }

  const isPasswordValid = await bcrypt.compare(password, foundUser.password);

  if (!isPasswordValid) {
    return next(new AppError("Invalid email or password", 401, "Authentication Error"));
  }

  const token = jwt.sign({ userId: foundUser._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
  });

  successResponse(res, 200, "Login successful", {
    user: buildUserResponse(foundUser),
    token,
  });
});

module.exports = {
  register,
  login,
};
