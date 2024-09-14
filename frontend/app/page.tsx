'use client';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Loader, X, Download, Camera, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactConfetti from 'react-confetti';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StlViewer } from "react-stl-viewer";

const exampleImages = [
  { src: '/api/placeholder/400/300', alt: 'Example 1' },
  { src: '/api/placeholder/400/300', alt: 'Example 2' },
  { src: '/api/placeholder/400/300', alt: 'Example 3' },
  { src: '/api/placeholder/400/300', alt: 'Example 4' },
  { src: '/api/placeholder/400/300', alt: 'Example 5' },
];

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [processedSTL, setProcessedSTL] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target?.result) {
        setUploadedImage(e.target.result as string);
        setProcessedSTL(null);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleRemoveImage = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setUploadedImage(null);
    setGeneratedImage(null);
    setProcessedSTL(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGet3DPrint = async () => {
    if (!uploadedImage) {
      return;
    }

    // // Mock processing
    // setIsLoading(true);
    // setError(null);
    // try {
    //   await new Promise((resolve) => setTimeout(resolve, 1000));
    //   setProcessedSTL('/output_3d_model.stl');
    // } catch (err) {
    //   setError('Failed to process image. Please try again.');
    // } finally {
    //   setIsLoading(false);
    // }
  
    setIsLoading(true);
    setError(null);
  
    try {
      // Health check with 2-second timeout
      const healthCheckController = new AbortController();
      const healthCheckTimeout = setTimeout(() => healthCheckController.abort(), 2000);
  
      try {
        const healthResponse = await fetch('http://localhost:8004/health', {
          signal: healthCheckController.signal
        });
        clearTimeout(healthCheckTimeout);
  
        if (!healthResponse.ok) {
          throw new Error(`Health check failed with status: ${healthResponse.status}`);
        }
        await healthResponse.json();
      } catch (healthError) {
        if (healthError instanceof Error && healthError.name === 'AbortError') {
          throw new Error("Health check timed out after 2 seconds");
        }
        throw new Error("Health check failed. Server might be unavailable.");
      }
  
      const formData = new FormData();
      const blob = await fetch(uploadedImage).then(r => r.blob());
      formData.append('file', blob, 'image.jpg');
  
      // Main request with 5-second timeout
      const mainRequestController = new AbortController();
      const mainRequestTimeout = setTimeout(() => mainRequestController.abort(), 500000000);
  
      try {
        const response = await fetch('http://localhost:8004/process_image', {
          method: 'POST',
          body: formData,
          signal: mainRequestController.signal
        });
        clearTimeout(mainRequestTimeout);
  
        if (!response.ok) {
          throw new Error(`Failed to process image. Server responded with status: ${response.status}`);
        }
  
        const data = await response.json();
        setProcessedSTL(`http://localhost:8004/stl_model/${data.stl_model}`);
      } catch (mainError) {
        if (mainError instanceof Error && mainError.name === 'AbortError') {
          throw new Error("Main request timed out");
        }
        throw mainError;
      }
    } catch (err) {
      setError(`Failed to process image: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTo3DPrinter = () => {
    setShowConfetti(true);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

  const handleSubmitAnother = () => {
    handleCloseDialog();
    setUploadedImage(null);
    setGeneratedImage(null);
    setProcessedSTL(null);
    setGeneratePrompt('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateImage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First, refine the prompt using the /chat endpoint
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: generatePrompt }),
      });
  
      if (!chatResponse.ok) {
        throw new Error('Failed to refine prompt. Please try again.');
      }
  
      const chatData = await chatResponse.json();
      const refinedPrompt = chatData.refinedPrompt;
  
      // Now use the refined prompt to generate the image
      const response = await fetch('/api/generate_image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: refinedPrompt }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to generate image. Please try again.');
      }
  
      const data = await response.json();
      if (data.image_url) {
        setGeneratedImage(data.image_url);
      } else {
        throw new Error("No image URL received. Please try again.");
      }
    } catch (err) {
      console.error("Error generating image:", err);
      setError("Failed to generate image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  const currentImage = activeTab === 'upload' ? uploadedImage : generatedImage;

  return (
    <div className="min-h-screen w-full bg-[#f0f0e8] text-gray-800 font-sans">
      <main className="flex flex-col items-center justify-start p-4 md:p-8 max-w-[2000px] mx-auto">
        {showConfetti && (
          <ReactConfetti
            recycle={true}
            numberOfPieces={200}
            initialVelocityY={10}
            colors={['#80e0b8', '#c0a8f8', '#f070b8', '#6880d0']}
          />
        )}
        
        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-center text-[#6880d0] font-serif">3D Print a Picture</h1>
        <p className="text-lg md:text-xl mb-12 text-center text-gray-600 font-light">Take a picture, get a 3D print of it!</p>
        
        <Card className="w-full max-w-3xl mb-16 shadow-lg bg-white">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger 
                  value="upload" 
                  className="flex items-center justify-center data-[state=active]:bg-[#80e0b8] data-[state=active]:text-white font-medium"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image
                </TabsTrigger>
                <TabsTrigger 
                  value="generate" 
                  className="flex items-center justify-center data-[state=active]:bg-[#c0a8f8] data-[state=active]:text-white font-medium"
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate Image
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upload">
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-full h-80 md:h-96 border-2 border-dashed rounded-lg cursor-pointer bg-[#f0f0e8] hover:bg-[#e0e0d8] transition-colors duration-300 relative overflow-hidden"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {uploadedImage ? (
                    <div className="w-full h-full flex items-center justify-center bg-black relative">
                      <img src={uploadedImage} alt="Uploaded" className="max-w-full max-h-full object-contain" />
                      <button
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-[#f070b8] text-white rounded-full p-2 hover:bg-[#e060a8] transition-colors duration-300"
                        aria-label="Remove image"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Camera className="w-16 h-16 mb-4 text-[#6880d0]" />
                      <p className="mb-2 text-xl md:text-2xl text-gray-600 text-center font-light">
                        <strong className="font-semibold">Click to upload</strong>
                        <br />
                        - or -
                        <br />
                        <strong className="font-semibold">Drop image here</strong>
                      </p>
                    </div>
                  )}
                </label>
                <input 
                  id="image-upload" 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileInput} 
                  accept="image/*"
                  ref={fileInputRef}
                />
              </TabsContent>
              <TabsContent value="generate">
                <div className="flex flex-col items-center space-y-4">
                  <Input
                    type="text"
                    placeholder="Describe your image..."
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                    className="w-full p-4 text-lg border-2 border-[#c0a8f8] rounded-lg focus:border-[#a088d8] focus:ring-2 focus:ring-[#c0a8f8] font-light"
                  />
                  <Button 
                    onClick={handleGenerateImage} 
                    disabled={isLoading || !generatePrompt}
                    className="w-full py-3 bg-[#80e0b8] hover:bg-[#60c098] text-white font-semibold rounded-lg transition-colors duration-300"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="mr-2 h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Image'
                    )}
                  </Button>
                  {error && (
                    <p className="text-[#f070b8] text-center font-medium">{error}</p>
                  )}
                  {generatedImage && (
                    <div className="w-full h-80 md:h-96 bg-black flex items-center justify-center mt-4 relative rounded-lg overflow-hidden">
                      <img src={generatedImage} alt="Generated" className="max-w-full max-h-full object-contain" />
                      <button
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-[#f070b8] text-white rounded-full p-2 hover:bg-[#e060a8] transition-colors duration-300"
                        aria-label="Remove image"
                      >
                        <X size={20} />
                      </button>
                      <Button
                        className="absolute bottom-2 right-2 bg-[#6880d0] hover:bg-[#5870c0] text-white"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedImage;
                          link.download = 'generated_image.png';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        title="Download Image"
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {currentImage && !processedSTL && (
          <Button 
            onClick={handleGet3DPrint} 
            disabled={isLoading}
            className="mb-20 py-3 px-6 bg-[#80e0b8] hover:bg-[#60c098] text-white font-semibold rounded-lg transition-colors duration-300"
          >
            {isLoading ? (
              <>
                <Loader className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Get 3D Print!'
            )}
          </Button>
        )}

        {processedSTL && (
          <Card className="w-full max-w-3xl mb-20 shadow-lg bg-white">
            <CardContent className="p-6">
              <h3 className="text-2xl font-bold mb-6 text-[#6880d0] font-serif">Your 3D Model is Ready!</h3>
              <div className="w-full h-80 md:h-96 bg-black flex items-center justify-center mb-8 relative rounded-lg overflow-hidden">
                <StlViewer
                  url={processedSTL}
                  orbitControls
                  shadows
                  className="w-full h-full"
                />
                <Button
                  className="absolute bottom-2 right-2 bg-[#6880d0] hover:bg-[#5870c0] text-white"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = processedSTL;
                    link.download = 'model.stl';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  title="Download STL"
                >
                  <Download className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex justify-center mt-4">
                <Button 
                  onClick={handleSendTo3DPrinter}
                  className="py-3 px-6 bg-[#80e0b8] hover:bg-[#60c098] text-white font-semibold rounded-lg transition-colors duration-300"
                >
                  Send to 3D Printer!
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <h2 className="text-3xl md:text-4xl font-bold mb-10 text-center w-full text-[#6880d0] font-serif">Example 3D Prints</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full">
          {exampleImages.map((image, index) => (
            <Card key={index} className="w-full transform hover:scale-105 transition-transform duration-300 shadow-lg bg-white">
              <CardContent className="p-3">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-auto rounded-lg"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
          <AlertDialogContent className="bg-white rounded-lg p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-[#80e0b8] mb-4 font-serif">3D Print Sent Successfully!</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 font-light">
                Your 3D print has been sent to the printer. Would you like to submit another picture?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogAction 
                onClick={handleSubmitAnother}
                className="bg-[#c0a8f8] hover:bg-[#a088d8] text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
              >
                Let's go again!!!
              </AlertDialogAction>
              <AlertDialogCancel 
                onClick={handleCloseDialog}
                className="bg-[#f0f0e8] hover:bg-[#e0e0d8] text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors duration-300 ml-4"
              >
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
