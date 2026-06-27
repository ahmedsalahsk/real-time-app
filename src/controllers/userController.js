const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");
const { sanitizeText } = require("../utils/sanitize");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchUsers = catchAsync(async (req, res) => {
  const search = sanitizeText(req.query.search);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const filter = {
    _id: { $ne: req.user._id },
  };

  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { username: { $regex: safeSearch, $options: "i" } },
      { displayName: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const users = await User.find(filter)
    .select("username displayName avatar")
    .sort({ username: 1 })
    .limit(limit)
    .lean();

  res.json(users);
});

module.exports = {
  searchUsers,
};
