const { GoogleGenerativeAI } = require("@google/generative-ai");
// Non serve require('dotenv') qui se lo carichi già in server.js o app.js

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

module.exports = model;