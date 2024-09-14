import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface DepthDataPlotProps {
  initialData: number[][];
}

const DepthDataPlot: React.FC<DepthDataPlotProps> = ({ initialData }) => {
  const [data, setData] = useState<number[][]>(initialData);
  const [incrementValue, setIncrementValue] = useState<number>(0);
  const [spread, setSpread] = useState<number>(1);
  const gridSize = 100;
  const maxSpread = Math.floor(gridSize / 2);
  const fixedGridWidth = 400; // Fixed width in pixels
  const cellSize = fixedGridWidth / gridSize; // Calculate cell size

  useEffect(() => {
    if (initialData.length === gridSize && initialData[0].length === gridSize) {
      setData(initialData);
    } else {
      // Fallback to dummy data if initialData is not in the correct format
      const dummyData: number[][] = Array.from({ length: gridSize }, (_, i) =>
        Array.from({ length: gridSize }, (_, j) => {
          const centerX = (gridSize - 1) / 2;
          const centerY = (gridSize - 1) / 2;
          const distanceFromCenter = Math.sqrt(
            Math.pow(i - centerX, 2) + Math.pow(j - centerY, 2)
          );
          const normalizedDistance = distanceFromCenter / (Math.sqrt(2) * centerX);
          return (1 - normalizedDistance) * 100;
        })
      );
      setData(dummyData);
    }
  }, [initialData]);

  const getColor = (depth: number): string => {
    const hue = (1 - depth / 100) * 240;
    return `hsl(${hue}, 100%, 50%)`;
  };

  const handleCellClick = (i: number, j: number): void => {
    const newData = data.map((row, rowIndex) =>
      row.map((depth, colIndex) => {
        const distance = Math.sqrt(Math.pow(rowIndex - i, 2) + Math.pow(colIndex - j, 2));
        if (distance <= spread) {
          const factor = 1 - (distance / spread);
          return Math.min(100, Math.max(0, depth + incrementValue * factor));
        }
        return depth;
      })
    );
    setData(newData);
  };

  const handleIncrementChange = (value: number[]): void => {
    setIncrementValue(value[0]);
  };

  const handleSpreadChange = (value: number[]): void => {
    setSpread(value[0]);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Depth Data Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-[120px_1fr_40px] items-center gap-4">
              <Label htmlFor="increment">Increment Value:</Label>
              <Slider
                id="increment"
                min={-10}
                max={10}
                step={0.1}
                value={[incrementValue]}
                onValueChange={handleIncrementChange}
              />
              <span className="text-right">{incrementValue.toFixed(1)}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr_40px] items-center gap-4">
              <Label htmlFor="spread">Spread (pixels):</Label>
              <Slider
                id="spread"
                min={1}
                max={maxSpread}
                step={1}
                value={[spread]}
                onValueChange={handleSpreadChange}
              />
              <span className="text-right">{spread}</span>
            </div>
          </div>
          <div 
            className="border rounded-lg overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              width: `${fixedGridWidth}px`,
              height: `${fixedGridWidth}px`,
              margin: '0 auto'
            }}
          >
            {data.flatMap((row, i) =>
              row.map((depth, j) => (
                <div
                  key={`cell-${i}-${j}`}
                  style={{
                    backgroundColor: getColor(depth),
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleCellClick(i, j)}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DepthDataPlot;