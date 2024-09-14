'use client';
import React, { useState } from 'react';
import DepthDataPlot from '@/components/depth_edit/DepthDataPlot';

const EditPage: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [data, setData] = useState<number[][]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedModifications, setAppliedModifications] = useState<any>(null);

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
        body: JSON.stringify({ input }),
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
    <div className="container mx-auto px-4">
      <h1 className="text-4xl md:text-6xl font-bold mb-6 text-center">Depth Edit</h1>
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            rows={4}
            placeholder="Enter your prompt to modify the depth data..."
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Generate Depth Data'}
          </button>
        </div>
      </form>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {appliedModifications && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Applied Modifications: </strong>
          <pre className="mt-2 whitespace-pre-wrap">
            {JSON.stringify(appliedModifications, null, 2)}
          </pre>
        </div>
      )}
      <DepthDataPlot initialData={data} />
    </div>
  );
};

export default EditPage;