import { GoogleGenAI } from "@google/genai";
import { WalletData } from "../types";

export const analyzeWallets = async (wallets: WalletData[]): Promise<string> => {
  try {
    // Safe access to process.env
    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
    
    if (!apiKey) {
      return "⚠️ AI Analysis Unavailable.\n\nTo enable this feature, please create a `.env` file in the project root and add your Gemini API Key:\n\nAPI_KEY=your_key_here\n\n(The rest of the dashboard functions normally without this.)";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Prepare a summary of the data to reduce token count
    const topGainers = [...wallets]
      .sort((a, b) => (b.currentBalance - (b.history[0]?.balance || b.initialBalance)) - (a.currentBalance - (a.history[0]?.balance || a.initialBalance)))
      .slice(0, 5)
      .map(w => ({ addr: w.address, bal: w.currentBalance, change: w.currentBalance - (w.history[0]?.balance || w.initialBalance) }));

    const topLosers = [...wallets]
      .sort((a, b) => (a.currentBalance - (a.history[0]?.balance || a.initialBalance)) - (b.currentBalance - (b.history[0]?.balance || b.initialBalance)))
      .slice(0, 5)
      .map(w => ({ addr: w.address, bal: w.currentBalance, change: w.currentBalance - (w.history[0]?.balance || w.initialBalance) }));

    const totalBalance = wallets.reduce((acc, curr) => acc + curr.currentBalance, 0);

    const prompt = `
      I have a dataset of ${wallets.length} Polygon wallets holding DAI stablecoin.
      Total DAI tracked: ${totalBalance.toLocaleString()}.
      
      Top 5 Accumulating Wallets (Address, Balance, 7D Change):
      ${JSON.stringify(topGainers)}

      Top 5 Decreasing Wallets (Address, Balance, 7D Change):
      ${JSON.stringify(topLosers)}

      Please provide a concise financial executive summary suitable for a crypto fund manager. 
      Focus on accumulation trends vs selling pressure. Are the whales accumulating or dumping?
      Format the output with Markdown. Keep it under 200 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Failed to generate analysis. Please check your API Key configuration or try again later.";
  }
};