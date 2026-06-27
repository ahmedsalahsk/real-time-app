const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    clientMessageId: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index(
  { user: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
  },
);

messageSchema.pre("validate", function () {
  if (!this.room && !this.conversation) {
    throw new Error("Message must belong to a room or conversation");
  }

  if (this.room && this.conversation) {
    throw new Error("Message cannot belong to both room and conversation");
  }
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
