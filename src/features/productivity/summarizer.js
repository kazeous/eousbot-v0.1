import { config } from "../../config.js";

export async function summarizeMessages(channel, limit = 50) {
  try {
    const messages = await channel.messages.fetch({ limit });
    
    // Reverse to get chronological order
    const sorted = [...messages.values()].reverse();
    
    // Filter and format the transcript
    const transcriptLines = [];
    const participants = new Set();
    let wordCount = 0;
    
    for (const msg of sorted) {
      if (msg.author.bot || !msg.content.trim()) continue;
      
      const authorName = msg.member?.displayName || msg.author.username;
      participants.add(authorName);
      
      const text = msg.content.substring(0, 300); // Truncate individual long messages
      transcriptLines.push(`${authorName}: ${text}`);
      wordCount += text.split(/\s+/).length;
    }

    if (transcriptLines.length === 0) {
      return "There are no recent user messages in this channel to summarize.";
    }

    const transcript = transcriptLines.join("\n");

    // 1. Try Google Gemini API
    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a helpful assistant. Summarize the following Discord chat transcript. Write a concise, 3-5 bullet point summary highlighting key topics, questions, and decisions. Do not include metadata in bullets. Keep the summary engaging.\n\nTranscript:\n${transcript}`
              }]
            }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (summaryText) {
            return `✨ **AI Summary (Gemini):**\n\n${summaryText.trim()}`;
          }
        }
      } catch (err) {
        console.error("Gemini API call failed, falling back:", err);
      }
    }

    // 2. Try OpenAI API
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant. Summarize Discord transcripts in 3-5 bullet points focusing on key topics, questions asked, and decisions made."
              },
              {
                role: "user",
                content: transcript
              }
            ],
            max_tokens: 250
          })
        });

        if (response.ok) {
          const data = await response.json();
          const summaryText = data.choices?.[0]?.message?.content;
          if (summaryText) {
            return `✨ **AI Summary (OpenAI):**\n\n${summaryText.trim()}`;
          }
        }
      } catch (err) {
        console.error("OpenAI API call failed, falling back:", err);
      }
    }

    // 3. Heuristic Local Heuristic Fallback
    return generateHeuristicSummary(transcriptLines, participants, wordCount);
    
  } catch (error) {
    console.error("Failed to compile summary:", error);
    return "⚠️ An error occurred while generating the conversation summary.";
  }
}

function generateHeuristicSummary(lines, participants, wordCount) {
  // Simple analysis: active participants, message count, and basic highlights
  const authorMsgCount = {};
  const words = [];
  
  for (const line of lines) {
    const parts = line.split(": ");
    const author = parts[0];
    const text = parts.slice(1).join(": ");
    
    authorMsgCount[author] = (authorMsgCount[author] || 0) + 1;
    
    // Collect non-trivial words for keyword matching
    const cleanWords = text.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 4 && !["about", "there", "their", "would", "could", "should", "think", "people"].includes(w));
    words.push(...cleanWords);
  }

  // Find top keywords
  const wordFreq = {};
  for (const w of words) {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => `\`#${entry[0]}\``)
    .join(", ");

  const activeUserList = [...participants].slice(0, 5).join(", ") + (participants.size > 5 ? "..." : "");
  const messagesAnalyzed = lines.length;

  return `📊 **Chat Digest (No AI Configured)**
* **Activity:** Analyzed **${messagesAnalyzed}** messages from **${participants.size}** contributors.
* **Top Contributors:** ${activeUserList}
* **Common Topics:** ${topKeywords || "None detected"}
* **Average Message Length:** ${Math.round(wordCount / messagesAnalyzed)} words.

*Configure \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` in settings to unlock smart AI-generated transcripts!*`;
}
