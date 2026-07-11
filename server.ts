import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON with a larger limit for base64 PDFs
  app.use(express.json({ limit: "25mb" }));

  // API Route for PDF extraction
  app.post("/api/import-pdf", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "Missing pdfBase64 data." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const pdfPart = {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        }
      };

      const prompt = `Analyze this cafe/restaurant menu PDF. Extract all the menu items and group/classify them into their categories. For each item, capture: category name, item name, price, vegetarian status (is_veg), GST rate (e.g. 5, 12, 18), HSN code (default 2101 or 2106), and any notes or description. Make sure to output valid JSON matching the schema precisely. Make sure category, name, and price are filled.`;

      // Helper function with exponential backoff for handling transient 503 / 429 Gemini errors
      const executeWithRetry = async (retries = 3, delay = 1000): Promise<any> => {
        try {
          return await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [pdfPart, prompt],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING, description: "Name of the category, e.g. Hot Coffee" },
                        name: { type: Type.STRING, description: "Name of the menu item" },
                        price: { type: Type.NUMBER, description: "Price of the menu item excluding GST" },
                        is_veg: { type: Type.BOOLEAN, description: "Whether the item is vegetarian (true) or non-vegetarian/egg (false)" },
                        gst_rate: { type: Type.INTEGER, description: "GST rate percentage (5, 12, or 18)" },
                        hsn_code: { type: Type.STRING, description: "HSN code (default 2101 or 2106)" },
                        notes: { type: Type.STRING, description: "Short note or description about the item" }
                      },
                      required: ["category", "name", "price"]
                    }
                  }
                },
                required: ["items"]
              }
            }
          });
        } catch (error: any) {
          const errStr = String(error);
          const isTransient = 
            errStr.includes("503") || 
            errStr.includes("UNAVAILABLE") || 
            errStr.includes("429") || 
            errStr.includes("RESOURCE_EXHAUSTED") ||
            (error.status && (error.status === 503 || error.status === 429));

          if (retries > 0 && isTransient) {
            console.warn(`Gemini call failed with transient error (${errStr}). Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return executeWithRetry(retries - 1, delay * 2);
          }
          throw error;
        }
      };

      const response = await executeWithRetry();

      const jsonText = response.text || "{\"items\": []}";
      const result = JSON.parse(jsonText);
      res.json(result);
    } catch (error: any) {
      console.error("Gemini PDF Import Error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
