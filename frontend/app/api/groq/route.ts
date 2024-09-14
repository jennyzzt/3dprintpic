// app/api/groq/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const systemPrompt = `You are a depth data modifier. Your task is to interpret the user's input and provide modifications to a 100x100 grid of depth values. The depth values range from 0 to 100, where 0 is the deepest and 100 is the shallowest.

Output format: Respond with a JSON object that describes how to modify the depth data. Your response should include one or more of the following properties:

1. "globalChange": A number between -100 and 100 to be applied to all depth values.
2. "regions": An array of objects describing specific regions to modify. Each object should have:
   - "shape": "circle", "rectangle", or "ellipse"
   - "center": [x, y] coordinates (0-99 for both x and y)
   - "size": For circles, a radius (0-50). For rectangles and ellipses, [width, height] (0-100 for both)
   - "change": A number between -100 and 100 to apply to this region

Example output:
{
  "globalChange": -10,
  "regions": [
    {
      "shape": "circle",
      "center": [50, 50],
      "size": 20,
      "change": 30
    },
    {
      "shape": "rectangle",
      "center": [25, 75],
      "size": [30, 40],
      "change": -20
    }
  ]
}

Interpret the user's input creatively, but ensure your output is valid JSON and follows this structure.`;

function generateBaseData(size: number): number[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      const centerX = (size - 1) / 2;
      const centerY = (size - 1) / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow(i - centerX, 2) + Math.pow(j - centerY, 2)
      );
      const normalizedDistance = distanceFromCenter / (Math.sqrt(2) * centerX);
      return Math.round((1 - normalizedDistance) * 100);
    })
  );
}

function applyModifications(baseData: number[][], modifications: any): number[][] {
  const size = baseData.length;
  const modifiedData = baseData.map(row => [...row]);

  // Apply global change
  if (typeof modifications.globalChange === 'number') {
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        modifiedData[i][j] = Math.max(0, Math.min(100, modifiedData[i][j] + modifications.globalChange));
      }
    }
  }

  // Apply regional changes
  if (Array.isArray(modifications.regions)) {
    modifications.regions.forEach((region: any) => {
      const { shape, center, size: regionSize, change } = region;
      const [centerX, centerY] = center;

      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          let isInRegion = false;

          if (shape === 'circle') {
            const distance = Math.sqrt(Math.pow(i - centerX, 2) + Math.pow(j - centerY, 2));
            isInRegion = distance <= regionSize;
          } else if (shape === 'rectangle') {
            const [width, height] = regionSize;
            isInRegion = Math.abs(i - centerX) <= width / 2 && Math.abs(j - centerY) <= height / 2;
          } else if (shape === 'ellipse') {
            const [a, b] = regionSize;
            const normalizedX = (i - centerX) / (a / 2);
            const normalizedY = (j - centerY) / (b / 2);
            isInRegion = (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
          }

          if (isInRegion) {
            modifiedData[i][j] = Math.max(0, Math.min(100, modifiedData[i][j] + change));
          }
        }
      }
    });
  }

  return modifiedData;
}

function extractJSONFromString(str: string): any {
    const jsonRegex = /{[\s\S]*}/;
    const match = str.match(jsonRegex);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (error) {
        console.error('Error parsing extracted JSON:', error);
      }
    }
    return null;
  }
  
  export async function POST(request: NextRequest) {
    try {
      const { input } = await request.json();
      console.log('Received input:', input);
  
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set in environment variables');
      }
  
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ],
        model: "llama3-8b-8192",
      });
  
      console.log('Groq API response:', chatCompletion);
  
      const output = chatCompletion.choices[0]?.message?.content || "{}";
      console.log('Raw output:', output);
      
      let modifications = extractJSONFromString(output);
      if (!modifications) {
        console.warn('Failed to parse LLM output as JSON. Using empty modifications.');
        modifications = {};
      }
  
      const baseData = generateBaseData(100);
      const modifiedData = applyModifications(baseData, modifications);
  
      return NextResponse.json({ output: modifiedData, appliedModifications: modifications });
    } catch (error) {
      console.error('Detailed error:', error);
      return NextResponse.json({ error: `An error occurred while processing your request: ${(error as Error).message}` }, { status: 500 });
    }
  }