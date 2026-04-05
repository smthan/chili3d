---
name: chili3d
description: Expert guidance for the Chili3D browser CAD monorepo—Three.js visualization (IVisual, ThreeView, picking, mesh lifecycle), OpenCascade over Emscripten WASM (ShapeFactory, OccShape, mesher, BREP/STEP/IGES), and app assembly (AppBuilder, commands, plugins). Use when editing this repository, WebGL/Web3D CAD, OCCT/WASM bindings, meshing, or plugins. Triggers 中文：Chili3D、浏览器CAD、Web3D、OpenCascade、WASM几何内核、Three.js 拾取与渲染。
---

# Chili3D

## Role

Act as a senior **browser CAD + WebGL** engineer familiar with **OpenCascade (OCCT)** topology/geometry and **Three.js** rendering. Prefer repository facts over generic OCCT/Three tutorials; extend existing patterns.

## Architecture (four layers)

1. **Domain (`@chili3d/core`)** — `IDocument`, `IApplication`, `IShape` / `IGeometry`, `IShapeFactory`, `IShapeConverter`, `IVisual` / `IView`, `Result<T>`, `History`, selection, commands (`ICommand`). No Three.js or WASM here.
2. **Adapters** — `@chili3d/wasm` (OCCT), `@chili3d/three` (WebGL).
3. **App (`@chili3d/app`)** — `Application`, `Document`, concrete commands, edit handlers.
4. **Shell** — `@chili3d/builder` (assembly), `@chili3d/web` (entry), `@chili3d/ui`, `@chili3d/element`, `plugins/*`.

Long-form narrative: see [learn.md](../../../learn.md) at repo root.

## Startup and globals

- Browser entry: `AppBuilder` chain — `useIndexedDB()` → `useWasmOcc()` → `useThree()` → `useUI()` → `build()`.
- `useWasmOcc()`: dynamic import `@chili3d/wasm`, `await initWasm()`, `new ShapeFactory()`.
- `initWasm()` loads `packages/wasm/lib/chili-wasm` and assigns **`global.wasm`** (Embind module). All OCC wrappers read APIs from `wasm.*`.

## OpenCascade in this codebase

| Area | Location |
|------|----------|
| C++ + CMake + Emscripten | `cpp/` → outputs to `packages/wasm/lib/chili-wasm.{js,wasm,d.ts}` |
| Embind surface | `cpp/src/opencascade.cpp`, `factory.cpp`, `shape.cpp`, `converter.cpp`, `mesher.cpp`, `geometry.cpp` |
| TS wrappers | `packages/wasm/src/` — `ShapeFactory`, `OccShape`, `OccShapeConverter`, curves/surfaces |

**Mental model**: `TopoDS_Shape` is the authoritative B-rep. Serialization uses **BREP strings** (`wasm.Converter.convertToBrep` / `convertFromBrep`). Exchange: STEP, IGES, BREP, STL import paths in `OccShapeConverter`.

**`ShapeFactory` pattern** (TypeScript): validate params → `ensureOccShape` (must be `OccShape`) → call `wasm.ShapeFactory.*` / `wasm.Shape.*` → `convertShapeResult` frees C++ `ShapeResult` and returns `Result<IShape, string>`.

**Meshing**: C++ `mesher.cpp` uses OCCT (`BRepMesh_IncrementalMesh`, `GCPnts_TangentialDeflection`, triangulation) to fill `EdgeMeshData` / `FaceMeshData` consumed by core and Three.js. Changing tessellation quality touches WASM + possibly `VisualConfig` / mesh callers.

## Three.js / Web3D in this codebase

| Area | Location |
|------|----------|
| Visual kernel | `packages/three/src/threeVisual.ts`, `threeVisualContext.ts` |
| View + render loop | `threeView.ts` — `WebGLRenderer`, `CSS2DRenderer`, `CameraController`, `ResizeObserver`, dirty `_needsUpdate` |
| Scene → meshes | `ThreeVisualContext` syncs `ModelManager` nodes to `ThreeGeometry` / groups |
| Geometry mapping | `threeGeometry.ts` — `Mesh`, `LineSegments2` + `LineSegmentsGeometry`, `Points`; **dispose** `geometry` on teardown |
| Picking | `Raycaster`, NDC ray via `rayAt` / `screenToWorld`; map hits back to core `VisualNode` / `IShape` / `ISubShape` |

**Performance habits**: batch WASM work; dispose Three buffers/materials when removing visuals; avoid redundant `visual.update()`; respect layer masks used for wireframe vs shaded (see `Constants.Layers`).

## Conventions (do not ignore)

- TypeScript/JavaScript: AGPL-3.0 file header, Biome (4 spaces, double quotes, 110 cols), package imports `@chili3d/*`, `Result<T>` for fallible ops.
- C++ WASM: LGPL-3.0 header, WebKit `clang-format`, C++17.
- After TS/JS edits: `npm run check`. Before push: `npm run test`. After `cpp/` changes: `npm run build:wasm`.

## Where to change what

- New modeling or boolean behavior: `cpp/src/factory.cpp` / `shape.cpp` + `packages/wasm/src/factory.ts` + core `IShapeFactory` if API changes.
- New exchange format: `converter.cpp` + `OccShapeConverter` + `DefaultDataExchange`.
- Rendering or picking: `packages/three/src/*`, core visual interfaces if abstractions change.
- New command: `packages/app/src/commands/*`, register in builder ribbon / command service.
- Plugins: `plugins/*`, manifest `public/plugins/plugins.json`.

## Additional reference

- OCCT embind types, mesh structs, and Three picking details: [reference.md](reference.md)
