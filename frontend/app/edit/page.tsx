'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DepthDataPlot from '@/components/edit/DepthDataPlot';

const EditPage: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [data, setData] = useState<number[][]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedModifications, setAppliedModifications] = useState<any>(null);

  useEffect(() => {
    const fetchInitialDepthData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('http://localhost:8004/depth_data_downsampled/output_depth_data.npy');
        if (!response.ok) {
          throw new Error(`Failed to fetch depth data: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        if (result.depth_data && Array.isArray(result.depth_data) && result.depth_data.length > 0) {
          setData(result.depth_data);
        } else {
          throw new Error('Invalid depth data format received from API');
        }
      } catch (error) {
        console.error('Error fetching initial depth data:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialDepthData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setAppliedModifications(null);
    try {
      const response = await fetch('/api/groq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input, currentData: data }),
      });
      if (!response.ok) {
        throw new Error(`API response was not ok: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();
      if (result.output && Array.isArray(result.output)) {
        setData(result.output);
        setAppliedModifications(result.appliedModifications);
      } else {
        throw new Error('Invalid data format received from API');
      }
    } catch (error: unknown) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f0f0e8] text-gray-800 font-sans">
      <main className="flex flex-col items-center justify-start p-4 md:p-8 max-w-[2000px] mx-auto">
        <div className="w-full max-w-3xl mb-6 flex justify-between items-center">
          <Link href="/">
            <Button variant="outline" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl md:text-6xl font-bold text-center text-[#6880d0] font-serif">Edit 3D Model</h1>
        </div>
        
        <Card className="w-full max-w-3xl mb-16 shadow-lg bg-white">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="flex flex-col space-y-4">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full p-4 text-lg border-2 border-[#c0a8f8] rounded-lg focus:border-[#a088d8] focus:ring-2 focus:ring-[#c0a8f8] font-light"
                  rows={4}
                  placeholder="Enter your prompt to modify the model..."
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#80e0b8] hover:bg-[#60c098] text-white font-semibold rounded-lg transition-colors duration-300"
                >
                  {isLoading ? (
                    <>
                      <Loader className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Generate Modifications'
                  )}
                </Button>
              </div>
            </form>
            
            {error && (
              <div className="bg-[#f070b8] text-white px-4 py-3 rounded-lg mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            
            {appliedModifications && (
              <div className="bg-[#80e0b8] text-white px-4 py-3 rounded-lg mb-6" role="alert">
                <strong className="font-bold">Applied Modifications ✓</strong>
              </div>
            )}
          </CardContent>
        </Card>
        
        {isLoading ? (
          <div className="flex justify-center items-center">
            <Loader className="h-32 w-32 animate-spin text-[#6880d0]" />
          </div>
        ) : data.length > 0 ? (
          <Card className="w-full max-w-3xl mb-16 shadow-lg bg-white">
            <CardContent className="p-6">
              <DepthDataPlot initialData={data} />
            </CardContent>
          </Card>
        ) : (
          <div className="text-center text-gray-500">No depth data available</div>
        )}
      </main>
    </div>
  );
};

export default EditPage;