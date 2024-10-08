import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/messageModel.js";
import Conversation from "../models/conversationModel.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "https://dbms-project-cr06.onrender.com/", // Allowing only the frontend to connect
		methods: ["GET", "POST"],
	},
});

const userSocketMap = {}; // userId: socketId

export const getRecipientSocketId = (recipientId) => {
	return userSocketMap[recipientId];
};

io.on("connection", (socket) => {
	console.log("user connected", socket.id);
	const userId = socket.handshake.query.userId;

	if (userId && userId !== "undefined") {
		userSocketMap[userId] = socket.id;
		io.emit("getOnlineUsers", Object.keys(userSocketMap));
	} else {
		console.error("Invalid or undefined userId.");
	}

	// Mark messages as seen and update the conversation's last message seen status
	socket.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
		try {
			await Message.updateMany(
				{ conversationId: conversationId, seen: false },
				{ $set: { seen: true } }
			);
			await Conversation.updateOne(
				{ _id: conversationId },
				{ $set: { "lastMessage.seen": true } }
			);
			io.to(userSocketMap[userId]).emit("messagesSeen", { conversationId });
		} catch (error) {
			console.error("Error updating message seen status:", error);
		}
	});

	// Handle user disconnect
	socket.on("disconnect", () => {
		console.log("user disconnected");
		delete userSocketMap[userId];
		io.emit("getOnlineUsers", Object.keys(userSocketMap));
	});
});

export { io, server, app };
