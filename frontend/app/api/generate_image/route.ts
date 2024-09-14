import { NextResponse } from 'next/server';
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    console.log("Received prompt:", prompt);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log("Sending request to Replicate API...");
    const output = await replicate.run("black-forest-labs/flux-pro", {
      input: { prompt: prompt.text, aspect_ratio: "9:16" }
    });

    console.log("Received output from Replicate API:", output);

    // Return the output directly without checking its type
    return NextResponse.json({ image_url: output });
  } catch (error) {
    console.log('Error generating image:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}