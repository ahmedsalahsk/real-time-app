const express = require("express");
const http = require("http");
require("dotenv").config();
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const rateLimiter = require("./middleware/rateLimiter");
const { initializeSocket } = require("./socket");
// express app
const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim())
  : "*";
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
  },
});
// port
const PORT = process.env.PORT || 3000;
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const directMessageRoutes = require("./routes/directMessages");
const userRoutes = require("./routes/users");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.use(cors({ origin: allowedOrigins }));
// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter({ windowMs: 60 * 1000, max: 180 }));

// routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});
// auth routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/dm", directMessageRoutes);
app.use("/api/users", userRoutes);

// health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// connect event
app.set("io", io);
initializeSocket(io);

app.use(notFound);
app.use(errorHandler);

// start server
server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
