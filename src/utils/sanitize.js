const sanitizeText = (value) => {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
};

module.exports = {
  sanitizeText,
};
