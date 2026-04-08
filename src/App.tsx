import React, { useState, useCallback, useMemo } from 'react';
import type { SuspensionModel } from './model/types';
import { createDefaultModel } from './model/defaults';
import { useSolver } from './hooks/useSolver';
import { InputPanel } from './components/InputPanel/InputPanel';
import { Viewport } from './components/Viewport/Viewport';
import { ChartsPanel } from './components/Charts/ChartsPanel';
import { exportCSV, exportModelJSON, downloadFile } from './utils/export';

export default function App() {
  const [model, setModel] = useState<SuspensionModel>(createDefaultModel);
  const [travel, setTravel] = useState(0);
  const [rackTravel, setRackTravel] = useState(0);

  const result = useSolver(model, rackTravel);

  // Find solved state for the current travel position (front RHS, front LHS, rear)
  const currentFrontQ = useMemo(() => {
    if (!result) return null;
    const idx = result.frontSweep.outputs.findIndex(o => Math.abs(o.travel - travel) < 1.5);
    return idx >= 0 ? result.frontSweep.solvedStates[idx] : null;
  }, [result, travel]);

  const currentFrontLHS_Q = useMemo(() => {
    if (!result) return null;
    const idx = result.frontSweepLHS.outputs.findIndex(o => Math.abs(o.travel - travel) < 1.5);
    return idx >= 0 ? result.frontSweepLHS.solvedStates[idx] : null;
  }, [result, travel]);

  const currentRearQ = useMemo(() => {
    if (!result) return null;
    const idx = result.rearSweep.outputs.findIndex(o => Math.abs(o.travel - travel) < 1.5);
    return idx >= 0 ? result.rearSweep.solvedStates[idx] : null;
  }, [result, travel]);

  const handleExportCSV = useCallback(() => {
    if (!result) return;
    const csv = exportCSV(result.frontSweep.outputs, result.rearSweep.outputs);
    downloadFile(csv, 'suspension_sweep.csv');
  }, [result]);

  const handleExportJSON = useCallback(() => {
    const json = exportModelJSON(model);
    downloadFile(json, 'suspension_model.json', 'application/json');
  }, [model]);

  const handleImportJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as SuspensionModel;
        setModel(imported);
      } catch (err) {
        console.error('Invalid JSON:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#111',
      color: '#ddd',
      fontFamily: "'Inter', 'SF Pro', -apple-system, sans-serif",
    }}>
      <InputPanel
        model={model}
        onChange={setModel}
        travel={travel}
        onTravelChange={setTravel}
        rackTravel={rackTravel}
        onRackTravelChange={setRackTravel}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
      />

      <Viewport
        frontHP={model.front.hardpoints}
        rearHP={model.rear.hardpoints}
        frontSolvedQ={currentFrontQ}
        frontSolvedQ_LHS={currentFrontLHS_Q}
        rearSolvedQ={currentRearQ}
        travel={travel}
        wheelbase={model.vehicle.wheelbase}
      />

      <ChartsPanel
        frontOutputs={result?.frontSweep.outputs ?? []}
        rearOutputs={result?.rearSweep.outputs ?? []}
        damperFront={model.front.damper}
        damperRear={model.rear.damper}
        rollAnalysis={result?.rollAnalysis ?? null}
        currentTravel={travel}
      />
    </div>
  );
}
