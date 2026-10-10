import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import Suitcase from './Suitcase';
import PackingItem from './PackingItem';
import catalogData from '../data/items_catalog.json';
import { Eye, Layers, RotateCcw, Box, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Preview offsets for the 6 canonical models to inspect them inside/above the suitcase
 */
const CANONICAL_SHOWCASE_LAYOUT = [
  { type: 'sneakers', position: [-0.095, 0.06, -0.12], label: 'Sneakers' },
  { type: 'hardcover_book', position: [0.095, 0.03, -0.12], label: 'Book' },
  { type: 'folded_denim', position: [-0.095, 0.04, 0.08], label: 'Denim' },
  { type: 'rolled_tshirt', position: [0.095, 0.05, 0.08], label: 'T-shirt' },
  { type: 'laptop_15', position: [0, 0.24, -0.06], label: 'Laptop 15"' },
  { type: 'tsa_liquid_pouch', position: [0, 0.24, 0.15], label: 'TSA Pouch' },
];

export default function Scene({ items = [], packingResult = null }) {
  const isPacked = Boolean(packingResult && packingResult.status === 'success');
  const [userViewMode, setUserViewMode] = useState(null);
  const [prevPackingResult, setPrevPackingResult] = useState(packingResult);
  const [showWireframe, setShowWireframe] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const controlsRef = useRef();

  // Reset user override if packingResult transitions
  if (packingResult !== prevPackingResult) {
    setPrevPackingResult(packingResult);
    setUserViewMode(null);
  }

  // Derive active view mode
  const viewMode = userViewMode ?? (
    isPacked && packingResult.items.length > 0
      ? 'packed'
      : items.length > 0
      ? 'selected'
      : 'showcase'
  );
  const setViewMode = setUserViewMode;

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // Staging shelf accommodates up to 4 items per page cleanly without clipping
  const ITEMS_PER_PAGE = 4;
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const visibleItems = items.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  /**
   * Staging Layout:
   * Positions items on an elevated inspection staging platform (Y >= 0.24m)
   * strictly above the suitcase rim (H = 0.20m), guaranteeing zero wall clipping.
   */
  const getStagingPosition = (slotIndex, item) => {
    const positions = [
      [-0.10, -0.10], // Slot 0: Top-Left
      [0.10, -0.10],  // Slot 1: Top-Right
      [-0.10, 0.11],  // Slot 2: Bottom-Left
      [0.10, 0.11],   // Slot 3: Bottom-Right
    ];
    const [x, z] = positions[slotIndex % 4];
    const itemHeightMetres = (item.dimensions[2] || 10) / 100;
    const y = 0.235 + itemHeightMetres / 2;
    return [x, y, z];
  };

  /**
   * Converts engine bounding box center coordinates (in cm) into Three.js metres.
   * Engine axes:
   *   X = width (0..40 cm), center at 20 -> Three.js X = (px - 20) / 100
   *   Y = depth (0..55 cm), center at 27.5 -> Three.js Z = (py - 27.5) / 100
   *   Z = height (0..20 cm), floor at 0 -> Three.js Y = pz / 100
   */
  const convertEngineToThree = (position) => {
    const [px, py, pz] = position;
    return [
      (px - 20) / 100,
      pz / 100,
      (py - 27.5) / 100,
    ];
  };

  return (
    <div className="relative flex-1 min-h-[500px] lg:min-h-[600px] bg-[#070b14] border border-[#1b2337] rounded-2xl flex flex-col overflow-hidden shadow-2xl select-none">
      {/* 3D Viewport Overlay Header Tools */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-[#0e1424]/90 border border-[#1e273e] backdrop-blur-md shadow-lg">
          {/* Packed Solution Button (when packed result exists) */}
          {isPacked && (
            <button
              type="button"
              onClick={() => setViewMode('packed')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'packed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Packed ({packingResult.items.length})</span>
            </button>
          )}

          {/* Selected Staging Mode Button */}
          <button
            type="button"
            onClick={() => setViewMode('selected')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'selected'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Staging ({items.length})</span>
          </button>

          {/* 6 Models Showcase Button */}
          <button
            type="button"
            onClick={() => setViewMode('showcase')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'showcase'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Showcase</span>
          </button>
        </div>

        {/* Staging Pagination when items > 4 in selected mode */}
        {viewMode === 'selected' && items.length > ITEMS_PER_PAGE && (
          <div className="flex items-center space-x-1 bg-[#0e1424]/90 border border-[#1e273e] backdrop-blur-md px-2 py-1 rounded-xl shadow-lg text-xs text-slate-300">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPageIndex(Math.max(0, currentPage - 1))}
              className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1">
              {currentPage + 1}/{totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPageIndex(Math.min(totalPages - 1, currentPage + 1))}
              className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Wireframe Bounds Toggle */}
        <button
          type="button"
          onClick={() => setShowWireframe(!showWireframe)}
          title="Toggle suitcase bounds guide"
          className={`p-1.5 rounded-xl border backdrop-blur-md text-xs font-medium transition-all ${
            showWireframe
              ? 'bg-[#152038] border-blue-500/40 text-blue-300'
              : 'bg-[#0e1424]/90 border-[#1e273e] text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Reset Camera */}
        <button
          type="button"
          onClick={resetCamera}
          title="Reset Camera View"
          className="p-1.5 rounded-xl bg-[#0e1424]/90 border border-[#1e273e] text-slate-400 hover:text-slate-200 backdrop-blur-md shadow-lg transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Top Right: Status Pill & Badges */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
        {viewMode === 'packed' && isPacked ? (
          <>
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 backdrop-blur-md shadow-lg text-[11px] text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{packingResult.items.length} Items Packed by Engine</span>
            </div>
            {packingResult.unplacedItems?.length > 0 && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-600/40 text-amber-200 text-[10px] font-medium backdrop-blur-md shadow-md">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{packingResult.unplacedItems.length} Unplaced Item{packingResult.unplacedItems.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </>
        ) : viewMode === 'selected' ? (
          <>
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#0e1424]/90 border border-[#1e273e] backdrop-blur-md shadow-lg text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>
                {items.length > 0
                  ? `${items.length} Item${items.length > 1 ? 's' : ''} Staged for Inspection`
                  : 'Suitcase Ready (Empty Selection)'}
              </span>
            </div>
            {items.length > 0 && !isPacked && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-600/40 text-amber-200 text-[10px] font-medium backdrop-blur-md shadow-md">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Visual Preview Only — Engine Packing Pending</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#0e1424]/90 border border-[#1e273e] backdrop-blur-md shadow-lg text-[11px] text-slate-300">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>6 Canonical 3D Models Showcase</span>
          </div>
        )}
      </div>

      {/* React Three Fiber Canvas */}
      <div className="w-full h-full flex-1 cursor-grab active:cursor-grabbing">
        <Canvas
          shadows
          camera={{ position: [0.70, 0.75, 0.85], fov: 42, near: 0.05, far: 20 }}
        >
          {/* Studio Lighting */}
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[1.2, 2.0, 1.2]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          />
          <directionalLight position={[-1.2, 1.0, -1.0]} intensity={0.4} color="#93c5fd" />
          <pointLight position={[0, 0.5, 0]} intensity={0.3} color="#ffffff" />

          {/* Interactive Suitcase (Internal 40 × 55 × 20 cm) */}
          <Suitcase />

          {/* Optional Wireframe Usable Cavity Guide: 40 W × 20 H × 55 D cm */}
          {showWireframe && (
            <mesh position={[0, 0.10, 0]}>
              <boxGeometry args={[0.40, 0.20, 0.55]} />
              <meshBasicMaterial
                color="#3b82f6"
                wireframe
                opacity={0.12}
                transparent
              />
            </mesh>
          )}

          {/* Render Items depending on active View Mode with Suspense for GLB loading */}
          <React.Suspense fallback={null}>
            {viewMode === 'packed' && isPacked ? (
              /* Mode 1: Packed Layout (Placed items inside suitcase at engine coordinates) */
              <group>
                {packingResult.items.map((placedItem) => {
                  const catalogItem = catalogData.find((c) => c.type === placedItem.type);
                  const color = catalogItem?.color || '#3b82f6';
                  return (
                    <PackingItem
                      key={placedItem.id}
                      type={placedItem.type}
                      color={color}
                      dimensions={placedItem.dimensions}
                      position={convertEngineToThree(placedItem.position)}
                      rotation={placedItem.rotation || [0, 0, 0]}
                    />
                  );
                })}
              </group>
            ) : viewMode === 'selected' ? (
              /* Mode 2: User's Selected Items Staging Preview (Elevated above rim) */
              <group>
                {items.length > 0 && (
                  <>
                    <mesh position={[0, 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                      <planeGeometry args={[0.38, 0.52]} />
                      <meshBasicMaterial
                        color="#3b82f6"
                        opacity={0.06}
                        transparent
                        wireframe
                      />
                    </mesh>

                    {visibleItems.map((item, idx) => (
                      <PackingItem
                        key={item.id}
                        type={item.type}
                        color={item.color}
                        dimensions={item.dimensions}
                        position={getStagingPosition(idx, item)}
                        rotation={[0, 0, 0]}
                      />
                    ))}
                  </>
                )}
              </group>
            ) : (
              /* Mode 3: All 6 Canonical Models Showcase Preview */
              <group>
                {CANONICAL_SHOWCASE_LAYOUT.map((layout) => {
                  const catalogItem = catalogData.find((c) => c.type === layout.type);
                  if (!catalogItem) return null;
                  return (
                    <PackingItem
                      key={layout.type}
                      type={catalogItem.type}
                      color={catalogItem.color}
                      dimensions={catalogItem.dimensions}
                      position={layout.position}
                      rotation={[0, 0, 0]}
                    />
                  );
                })}
              </group>
            )}
          </React.Suspense>

          {/* Soft Ground Contact Shadow underneath suitcase */}
          <ContactShadows
            position={[0, -0.045, 0]}
            opacity={0.7}
            scale={1.4}
            blur={2.0}
            far={1.0}
            color="#000000"
          />

          {/* Smooth OrbitControls for 360-degree inspection */}
          <OrbitControls
            ref={controlsRef}
            target={[0, 0.12, 0]}
            enableDamping
            dampingFactor={0.06}
            minDistance={0.35}
            maxDistance={2.5}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>
      </div>

      {/* Bottom Floating Notice */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1 rounded-full bg-[#0b101c]/90 border border-[#1c263d] backdrop-blur-md text-[11px] text-slate-400 text-center shadow-lg pointer-events-none">
        Drag to rotate • Scroll to zoom • Right-click to pan
      </div>
    </div>
  );
}
