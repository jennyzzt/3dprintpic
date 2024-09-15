import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface DepthDataPlotProps {
  initialData: number[][];
}

const DepthDataPlot: React.FC<DepthDataPlotProps> = ({ initialData }) => {
  const [data, setData] = useState<number[][]>([]);
  const [incrementValue, setIncrementValue] = useState<number>(0.1);
  const [spread, setSpread] = useState<number>(5);
  const [gridRows, setGridRows] = useState<number>(100);
  const [gridCols, setGridCols] = useState<number>(100);
  const fixedGridWidth = 400; // Fixed width in pixels
  const maxSpread = Math.floor(Math.min(gridRows, gridCols) / 2);

  const SPECIAL_VALUE = -12345678;

  const { minValue, maxValue } = useMemo(() => {
    if (data.length === 0) return { minValue: 0, maxValue: 100 };
    const allValues = data.flat().filter(value => value !== SPECIAL_VALUE);
    return {
      minValue: Math.min(...allValues),
      maxValue: Math.max(...allValues)
    };
  }, [data]);

  useEffect(() => {
    if (initialData.length > 0 && initialData[0].length > 0) {
      setGridRows(initialData.length);
      setGridCols(initialData[0].length);
      setData(initialData);
    } else {
      console.warn('Invalid initialData, using dummy data');
      const dummyData = generateDummyData(100, 100);
      setGridRows(100);
      setGridCols(100);
      setData(dummyData);
    }
  }, [initialData]);

  const generateDummyData = useCallback((rows: number, cols: number): number[][] => {
    return Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) => {
        const centerX = (cols - 1) / 2;
        const centerY = (rows - 1) / 2;
        const distanceFromCenter = Math.sqrt(
          Math.pow(i - centerY, 2) + Math.pow(j - centerX, 2)
        );
        const normalizedDistance = distanceFromCenter / (Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2)));
        return (1 - normalizedDistance) * 100;
      })
    );
  }, []);

  const getColor = useCallback((depth: number): string => {
    if (depth === SPECIAL_VALUE) return 'black';
    const normalizedDepth = (depth - minValue) / (maxValue - minValue);
    const hue = normalizedDepth * 240; // Red (0) to Blue (240)
    return `hsl(${hue}, 100%, 50%)`;
  }, [minValue, maxValue]);

  const handleCellClick = useCallback((i: number, j: number): void => {
    setData(prevData => prevData.map((row, rowIndex) =>
      row.map((depth, colIndex) => {
        if (depth === SPECIAL_VALUE) return depth; // Don't modify special value
        const distance = Math.sqrt(Math.pow(rowIndex - i, 2) + Math.pow(colIndex - j, 2));
        if (distance <= spread) {
          const factor = 1 - (distance / spread);
          return depth - incrementValue * factor;
        }
        return depth;
      })
    ));
  }, [incrementValue, spread]);

  const handleIncrementChange = useCallback((value: number[]): void => {
    setIncrementValue(value[0]);
  }, []);

  const handleSpreadChange = useCallback((value: number[]): void => {
    setSpread(value[0]);
  }, []);

  const cellSize = Math.min(fixedGridWidth / gridCols, fixedGridWidth / gridRows);
  const gridWidthPx = cellSize * gridCols;
  const gridHeightPx = cellSize * gridRows;

  const getCellTitle = useCallback((depth: number): string => {
    if (depth === SPECIAL_VALUE) return 'Special Value';
    if (typeof depth === 'number' && !isNaN(depth)) {
      return `Value: ${depth.toFixed(2)}`;
    }
    return 'Invalid Value';
  }, []);

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
            className="border rounded-lg overflow-hidden mx-auto"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              width: `${gridWidthPx}px`,
              height: `${gridHeightPx}px`,
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
                  title={getCellTitle(depth)}
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