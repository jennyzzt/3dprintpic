'use client';
import DepthDataPlot from '@/components/depth_edit/DepthDataPlot';
import React from 'react';


const EditPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-bold mb-6 text-center">Depth Edit</h1>
      <DepthDataPlot />
    </div>
  );
};

export default EditPage;