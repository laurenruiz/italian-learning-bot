import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
// Remove unused imports unless needed
// import OpenAI from "openai";
// import fetch from "node-fetch";

const systemPrompt = `You are a friendly, encouraging, and knowledgeable Italian language tutor. Your role is to engage in a natural, one-response-at-a-time conversation with the student. Respond only to the student's latest message and avoid generating hypothetical dialogue or multiple follow-up scenarios. Keep your answer concise and in Italian, offering gentle corrections if needed, and then wait for the student’s next input. If the student is confused or doesn't understand what you are saying, that means the student doesn't understand that phrase and walk them through it in English.`;

export async function POST(req) {
    try {
        const { messages } = await req.json();

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { error: "Conversation history is required." },
                { status: 400 }
            );
        }

        const conversationHistory = messages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join("\n");
        const prompt = `${systemPrompt}\n${conversationHistory}\nassistant: `;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();

        return new NextResponse(text);
    } catch (error) {
        console.error("Error getting content:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
