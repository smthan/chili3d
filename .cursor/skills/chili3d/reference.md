# Chili3D — OpenCascade & Web3D reference

Use this file when SKILL.md is not enough detail.

## OCCT concepts Chili3D actually uses

- **Topology**: `TopoDS_Shape`, `TopoDS_Face`, `TopoDS_Edge`, `TopoDS_Wire`, `TopoDS_Shell`, `TopoDS_Solid`, `TopoDS_Compound`, `TopoDS_Vertex`. Enum `TopAbs_ShapeEnum` is exposed to JS via `opencascade.cpp`.
- **Geometry**: `Geom_Curve`, `Geom_Surface`, conics, BSpline,Bezier, elementary surfaces (plane, cylinder, sphere, etc.). Bound to JS for transforms and evaluation (`d0`, `value`, …).
- **Meshing pipeline** (`mesher.cpp`): incremental mesh on faces; edge sampling via `GCPnts_TangentialDeflection` with angle deflection constant; outputs packed float arrays for positions, normals, UVs, indices, plus group ranges for sub-shape highlighting.
- **Continuity / join**: `GeomAbs_Shape`, `GeomAbs_JoinType` exposed for filleting and surface operations.

## WASM build (high level)

- CMake builds OCCT subset + `cpp/src/*.cpp` into `chili-wasm`.
- Emscripten: `MODULARIZE`, `EXPORT_ES6`, embind (`--bind`), TypeScript declarations emitted to `chili-wasm.d.ts`.
- Memory: large initial heap and growth flags are set in CMake (see `learn.md` §4.1).

## TypeScript OCC wrappers

- **`OccShape`**: implements `IShape`; lazy `Mesher` for `mesh` property; serialize via BREP string.
- **`OccCurve` / `OccSurface`**: align with `Geom_*` handles; cooperate with `helper.ts` for matrix/orientation/join enums.
- **Interop**: `wasm.Transient`, `wasm.Converter`, `wasm.Shape`, `wasm.ShapeFactory`, `wasm.Edge` — verify names in `packages/wasm/lib/chili-wasm.d.ts` before assuming API.

## Three.js specifics in Chili3D

- **Two renderers**: WebGL for geometry; CSS2D for labels/overlays (`CSS2DRenderer` + `cssObjects` group).
- **Thick lines**: `LineSegments2` + `LineMaterial` for edges (not raw `LineSegments` only).
- **Materials**: `ThreeVisualContext` mirrors `Material` nodes from core; updates propagate via `DeepObserver`.
- **Highlighter**: works with shape mesh index ranges from picking for sub-shape emphasis.
- **Export**: mesh formats (STL/PLY/OBJ) go through Three scene / exporter; exact B-rep stays on OCC side.

## Common pitfalls

- Passing non-`OccShape` into `ShapeFactory` throws — kernel is OCC-only in this stack.
- Forgetting to delete/dispose Embind handles or `ShapeResult` — follow existing `convertShapeResult` / `gc()` patterns in converters.
- Leaking `BufferGeometry` or materials when removing `ThreeGeometry` — mirror `dispose()` in `threeGeometry.ts`.

## Related docs

- [AGENTS.md](../../../AGENTS.md) — commands, style, tests
- [learn.md](../../../learn.md) — full architecture walkthrough (Chinese)
