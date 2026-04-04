## Chili3D 项目解构与架构梳理

### 1. 总体概览

Chili3D 是一个基于浏览器的 3D CAD 应用/框架，核心特点：

- **技术栈**：TypeScript + Three.js + OpenCascade（通过 WebAssembly）  
- **运行形态**：纯前端应用，几何内核和布尔/曲面/网格运算全部在浏览器本地 WASM 中完成  
- **组织结构**：一个 TypeScript monorepo（`packages/*`）+ 一个 C++/OCCT WASM 模块（`cpp`）

整体可以粗略分成四层：

1. **核心领域层（`@chili3d/core`）**：文档模型、几何/拓扑抽象、命令与服务、事件系统等纯 TS 抽象内核  
2. **引擎适配层**：  
   - 可视化内核：`@chili3d/three`，基于 Three.js 实现 `IVisual` / `IView`  
   - 几何内核：`@chili3d/wasm`，对 C++ OpenCascade WASM 的封装，提供 `IShapeFactory`、`IShapeConverter`  
3. **应用层（`@chili3d/app` + `@chili3d/builder`）**：命令系统（建模/布尔/测量等）、文档与 Application 实现、UI 绑定、数据导入导出等  
4. **外壳层（`@chili3d/web` + `@chili3d/ui` + `@chili3d/elements`）**：浏览器入口、Ribbon 界面、控件/对话框等

WASM 部分（`cpp` + `packages/wasm/lib/chili-wasm`）则实现 OCCT 几何/布尔/造型算法，导出到 TS 层。

---

### 2. Monorepo 目录与包职责

根目录关键文件：

- `package.json`：定义 monorepo，`workspaces: ["packages/*", "plugins/*"]`，构建/开发脚本：  
  - `npm run dev`：Rspack dev server  
  - `npm run build`：生产构建  
  - `npm run build:wasm`：进入 `cpp` 用 CMake + Emscripten 构建 WASM  
  - `npm run check` / `npm run format`：Biome + clang-format  
  - `npm run test` / `npm run testc`：Rstest + 覆盖率  
- `cpp/`：OpenCascade + 自定义 C++ 几何模块，生成 `packages/wasm/lib/chili-wasm.{js,wasm,d.ts}`  
- `.github/workflows`：CI，主要跑构建和检查

`packages` 下 10 个核心包（AGENTS.md 已列出）：

- **`@chili3d/core`**：  
  - 定义关键接口：`IApplication`、`IDocument`、`IView`、`IVisual`、`IShape`、`IGeometry`、`IService` 等  
  - 基础设施：事件系统 `PubSub`、可观察对象 `Observable` / `ObservableCollection`、历史/撤销重做 `History`、`Result<T>` 错误处理模式等  
  - 文档/模型：`ModelManager`、选择系统 `ISelection`、`SelectionFilter` 等  
  - 编辑器与视图抽象：`IEditor`（指针事件）、`IView`（视图 + 工作平面）  
  - UI 抽象：`IWindow`、Ribbon 配置 `RibbonTabProfile`  
  - 国际化：`I18n`、语言资源接口  

- **`@chili3d/app`**：  
  - `Application` 实现 `IApplication`：  
    - 持有 `visualFactory`、`shapeFactory`、`services`、`storage`、`dataExchange`、`pluginManager`  
    - 管理 `views: ObservableCollection<IView>` 与 `documents: Set<IDocument>`  
    - 统一拖拽导入、插件加载、文档打开/保存等逻辑  
  - 具体 `Document` 实现、命令系统（`commands/*`）、建模主体封装（`bodys/*`）  
  - 编辑事件处理器 `EditEventHandler`，将选择/编辑行为绑定到文档模型  

- **`@chili3d/builder`**：  
  - `AppBuilder`：负责把所有内核/服务/界面按“模块化流水线”拼装成一个 `IApplication` 实例，是**应用装配器**：  
    - `useIndexedDB()`：初始化 `@chili3d/storage` 中的 `IndexedDBStorage`  
    - `useWasmOcc()`：`import("@chili3d/wasm")`，调用 `initWasm()`，构造 `ShapeFactory` 作为 `IShapeFactory`  
    - `useThree()`：`import("@chili3d/three")`，用 `ThreeVisulFactory` 作为 `IVisualFactory`  
    - `useUI()`：`import("@chili3d/ui")`，用 `MainWindow` 和默认 Ribbon（`./ribbon.ts`）构建 Office 风格界面  
    - `getServices()`：注册 `CommandService` / `HotkeyService` / `EditorService` 等  
    - `build()`：按 `_inits` 顺序依次初始化所有模块，构建 `Application`，初始化主窗体与默认插件  
  - `DefaultDataExchange`：实现 `IDataExchange`，负责 STEP/IGES/BREP/STL/PLY/OBJ 的导入导出（对接 `shapeFactory.converter` 与 `visual.meshExporter`）  

- **`@chili3d/web`**：浏览器入口：  
  - 在 `index.ts` 中：  
    - 创建加载动画组件 `Loading`  
    - `new AppBuilder().useIndexedDB().useWasmOcc().useThree().useUI().build()`  
    - 根据 URL 查询参数 `plugin` / `url`（或 `model`）自动加载插件或远程模型  
  - 可以理解为“应用启动脚本 + URL 协议/集成入口”

- **`@chili3d/three`**：Three.js 渲染内核：  
  - `ThreeVisual` 实现 `IVisual`：  
    - `scene`（Three.Scene） + 环境光 + 坐标轴  
    - 默认选择事件处理器 `NodeSelectionHandler`（基于 core 的节点系统）  
    - 视图事件处理器 `ThreeViewHandler`  
    - `ThreeVisualContext`：统一管理 Three.js 对象、网格、CSS2D 文本等  
    - `ThreeHighlighter`：高亮选中形体/子形体  
    - `ThreeMeshExporter`：将当前可视场景导出 STL/PLY/OBJ  
    - `createView(name, workplane)`：创建 `ThreeView`
  - `ThreeView` 实现 `IView`：  
    - 包含 `Scene`、`WebGLRenderer`、`CSS2DRenderer`、相机控制器 `CameraController`、工作平面 `Plane`、视图 Gizmo  
    - 管理 DOM 挂载、`ResizeObserver` 监听大小变化、`requestAnimationFrame` 渲染循环  
    - 提供一系列 Picking / 投影 API：`rayAt`、`screenToWorld`、`worldToScreen`、`detectVisual`、`detectShapes` / `detectShapesRect` 等  
    - 基于 Three 的 `Raycaster` + 自定义几何包装，把“鼠标位置”转换成对 core `IShape` / `ISubShape` 的选中  
  - `ThreeVisulFactory`：`kernelName = "three"`，用于 `AppBuilder.useThree()` 注入

- **`@chili3d/wasm`**：OpenCascade 几何内核封装：  
  - `initWasm()`：通过 `MainModuleFactory` 初始化 `../lib/chili-wasm` 模块，并挂到 `global.wasm`，为其它类统一访问 OCCT API  
  - `ShapeFactory` 实现 `IShapeFactory`：  
    - 所有建模/布尔/变换 API（`box` / `cylinder` / `sphere` / `loft` / `sweep` / `revolve` / `booleanCommon` / `fillet` / `chamfer` / `makeThickSolid` 等）都是对 `wasm.ShapeFactory.*` / `wasm.Shape.*` 的包装  
    - 负责类型校验（确保是 `OccShape`）、参数检查（如半径是否过小）、调用 OCCT、以及把 `ShapeResult` 转成 `Result<IShape, string>`  
  - `OccGeometry`、`OccShape`、`OccCurve` 等：把 OCCT 几何对象（`Geom_Geometry` / `TopoDS_Shape`）包装成 core 的 `IGeometry` / `IShape` 实现，并处理生命周期（`Handle_Geom_Geometry.delete()` 等）  
  - `converter`：`OccShapeConverter` 实现 `IShapeConverter`，负责 BREP/STEP/IGES/STL 与内部 `IShape` 的互转

- **`@chili3d/ui` / `@chili3d/elements`**：  
  - `ui`：包含 `MainWindow`、Ribbon 界面、对话框、弹出层、永久提示（`permanent`）、OK/Cancel 等基础 UI 组件  
  - `elements`：底层 DOM/HTML 封装（`div`/`span`/`svg` 等）、控件集合（按钮、单选组、集合类型控件等），作为 UI 组件的通用基础

- **`@chili3d/storage`**：  
  - 目前主要是 `IndexedDBStorage`，实现 `IStorage` 接口，用于文档持久化（按 id 存储/读取 `.cd` 文档）

- **`@chili3d/i18n`**：  
  - 提供多语言资源（`en.ts`、`zh-cn.ts`、`pt-br.ts`），导出的 `Locale` 会被 `I18n.addLanguage` 注册  
  - `AppBuilder` 在构造时自动初始化 i18n

除此之外还有 `plugins/*`：演示如何通过插件扩展应用（自定义命令、UI、语言等）。

---

### 3. 运行时总体架构与调用链路

#### 3.1 启动与装配流程

浏览器启动过程（`@chili3d/web/src/index.ts`）：

1. 创建并挂载一个 `Loading` 组件到 `document.body`  
2. 调用：
   ```ts
   new AppBuilder()
       .useIndexedDB()
       .useWasmOcc()
       .useThree()
       .useUI()
       .build()
       .then(handleApplicationBuilt)
   ```
3. `AppBuilder` 内部：  
   - 在构造函数中：  
     - 初始化 Config `Config.instance.init("config")`  
     - 初始化 I18n：动态导入 `@chili3d/i18n`，注册多语言  
     - `ensureAPI()`：在 `globalThis.ChiliCore` 上暴露 core API，方便插件/调试使用  
   - 调用 `useIndexedDB()`：导入 `@chili3d/storage`，实例化 `IndexedDBStorage`  
   - 调用 `useWasmOcc()`：导入 `@chili3d/wasm`，执行 `initWasm()`，并创建 `ShapeFactory`  
   - 调用 `useThree()`：导入 `@chili3d/three`，创建 `ThreeVisulFactory`  
   - 调用 `useUI()`：导入 `@chili3d/ui`，创建 `MainWindow`（带 Ribbon）  
4. `build()`：  
   - 依次执行 `_inits` 中的异步初始化任务（i18n、API、Storage、WASM、Three、UI）  
   - 校验必须组件是否存在（`shapeFactory` / `visualFactory` / `storage`）  
   - 构建 `Application`，注入：  
     - `shapeFactory`（来自 `@chili3d/wasm`）  
     - `visualFactory`（来自 `@chili3d/three`）  
     - `storage`（`IndexedDBStorage`）  
     - `services`（命令、快捷键、编辑事件）  
     - `dataExchange`（`DefaultDataExchange`）  
   - 调用 `MainWindow.init(app)` 绑定 UI 与应用  
   - 尝试加载默认插件（`/plugins/plugins.json`）  
   - 允许附加模块（`IAdditionalModule`）注入自己的 Ribbon 命令和额外多语言

`handleApplicationBuilt` 中会解析 URL 参数：

- `plugin`：自动通过 `app.pluginManager.loadFromUrl(plugin)` 加载远程插件  
- `url`/`model`：自动调用 `app.loadFileFromUrl(url)` 加载外部 CAD 文件

#### 3.2 Application / Document / View 三者关系

- **`Application`（`@chili3d/app`）**：  
  - 单例（`setCurrentApplication` / `getCurrentApplication` 约束只创建一次）  
  - 职责：  
    - 管理 `documents: Set<IDocument>` 与 `views: ObservableCollection<IView>`  
    - 追踪当前视图 `activeView` 与当前正在执行的命令 `executingCommand`  
    - 管理服务（命令/热键/编辑事件）与插件系统  
    - 统一处理文件拖拽导入、插件文件加载、模型导入导出  
  - 创建/打开文档：  
    - `newDocument(name)`：构造 `Document`，初始化默认材质，创建 3D 视图  
    - `openDocument(id)`：从 `storage` 打开 `.cd` 文档，构建对应视图  
    - `loadDocument(data: Serialized)`：从序列化数据重建文档  
  - 视图创建：`createActiveView(document)` 使用 `document.visual.createView("3d", Plane.XY)` 创建默认 3D 视图，并设置相机为正交

- **`Document`**（`@chili3d/app/src/document.ts` + `@chili3d/core/src/document.ts`）：  
  - 接口层（core）：  
    - `selection: ISelection`：当前选择  
    - `history: History`：带撤销/重做栈的操作历史  
    - `visual: IVisual`：文档的可视化内核  
    - `modelManager: ModelManager`：几何/拓扑节点树、材质等  
  - 实现层（app）：  
    - 管理节点树（`ShapeNode`、`EditableShapeNode` 等）与可视节点  
    - 实现 `save()` / `close()` / `serialize()` 与 `storage` / `dataExchange` 对接  

- **`View`**（`@chili3d/three/src/threeView.ts`）：  
  - 挂接到 `Document.visual`，每个文档可以有多个视图（不同工作平面 / 视图模式）  
  - 持有 Three.js 的 `Scene` / `Camera` / 渲染器，并与 DOM `HTMLElement` 绑定  
  - 负责**屏幕坐标 ↔ 世界坐标 ↔ 几何/拓扑对象**的映射与拾取逻辑  

三者形成典型的结构：

> Application（全局上下文 + 服务 + 插件）  
> → 包含多个 Document（文档/模型 + 历史 + 选择 + Visual）  
> → 每个 Document 通过 Visual 创建一个或多个 View（Three.js 视图 + 工作平面）

---

### 4. 几何内核与 WASM 工作原理

#### 4.1 C++ / OpenCascade 端

`cpp/CMakeLists.txt` 描述了 WASM 构建过程：

- 从 `build/occt/src/*` 中收集 OCCT 源码（根据 toolkit 中声明的 PACKAGE 列表）  
- 生成 `occt` 静态库，并配置包含目录 `OcctIncludeDirs`  
- 将 `cpp/src/*.cpp` / `*.hpp` 作为 ChiliWasm 自己的源码 `ChiliWasmSourceFiles`  
- 在 Emscripten 环境下：  
  - `add_executable(chili-wasm ...)`，编译 OpenCascade + Chili 自有代码  
  - `target_link_options` 中指定：  
    - `-sMODULARIZE=1`、`-sEXPORT_ES6=1`：生成 ESModule 形式的加载器  
    - 内存相关配置：栈 8MB、初始堆 64MB、允许内存增长、最大 4GB  
    - `--bind`：启用 embind，生成 JS 绑定  
    - `--emit-tsd "chili-wasm.d.ts"`：自动生成 TypeScript 声明文件  
  - `install()` 把 `chili-wasm.js` / `chili-wasm.wasm` / `chili-wasm.d.ts` 安装到 `packages/wasm/lib`

`cpp/src/*` 中则实现对 OCCT 的实际封装，包括：

- 基本几何类型与变换（`geometry.cpp` / `transient.cpp`）  
- 各种造型操作（`shape.cpp` / `factory.cpp`）  
- 网格生成与导出（`mesher.cpp` / `geometry.cpp`）  
- 辅助函数（`utils.cpp`）  
- 与 JS 交互适配（`shared.*` / `opencascade.cpp`）

这些通过 embind 暴露为 `wasm.ShapeFactory`、`wasm.Shape`、`wasm.Transient` 等 JS/WASM API，最终由 `@chili3d/wasm` 消费。

#### 4.2 TypeScript 端几何抽象

在 `@chili3d/core` 中，关于几何的抽象大致分为：

- `IGeometry` / `IShape` / `IVertex` / `IEdge` / `IFace` / `IShell` / `ISolid` / `ICompound` 等  
- `GeometryType` / `ShapeType` / `ShapeTypeUtils`：用枚举描述是曲线/曲面/体/边/面等  
- `IShapeFactory` / `IShapeConverter`：统一造型接口与数据格式互转接口  

`@chili3d/wasm` 中的 OCC 相关类实现这些接口：

- `OccGeometry` 实现 `IGeometry`：  
  - 内部持有 `Geom_Geometry` + `Handle_Geom_Geometry`  
  - 通过 `wasm.Transient.isKind` 判断曲线/曲面类型，映射到 `GeometryType`  
  - 实现 `transform(Matrix4)`，调用 OCCT transform  

- `OccShape`、`OccEdge`、`OccCurve` 等实现 `IShape` 对应子类：  
  - 内部保存 `TopoDS_Shape` 指针  
  - 实现各种拓扑访问、查找子形体、对比等（依赖 OCCT API）  

- `ShapeFactory` 实现 `IShapeFactory`：  
  - 封装所有形体构造与运算：  
    - 基本形体：`point` / `line` / `circle` / `ellipse` / `rect` / `box` / `cylinder` / `cone` / `sphere` / `pyramid` / `polygon` 等  
    - 组合/变换：`wire` / `face` / `shell` / `solid` / `prism` / `sweep` / `revolve` / `combine`  
    - 布尔运算：`booleanCommon` / `booleanCut` / `booleanFuse`（内部还会对结果 `simplifyShape`）  
    - 特征编辑：`fillet` / `chamfer` / `removeFeature` / `removeSubShape` / `replaceSubShape` / `makeThickSolidBySimple` / `makeThickSolidByJoin`  
    - 其他：`curveProjection`、`loft` 等  
  - 几乎所有方法都遵循同一个模式：  
    1. 校验参数（半径/距离/向量长度等）  
    2. 使用 `ensureOccShape` 断言传入的是 OCC 形体  
    3. 调用对应的 `wasm.ShapeFactory.*` 或 `wasm.Shape.*`  
    4. 用 `convertShapeResult` 将 `ShapeResult` 转成 `Result<IShape, string>` 并负责释放 C++ 侧的结构体

导入/导出流程由 `DefaultDataExchange` 串起来：

- 导入：  
  - 根据后缀选择 `convertFromBrep` / `convertFromSTL` / `convertFromSTEP` / `convertFromIGES`  
  - 如果成功，包装为 `EditableShapeNode` 加入 `document.modelManager` 并触发 `document.visual.update()`  
- 导出：  
  - 如果选择 STL/PLY/OBJ：走 Three 侧 `meshExporter` 从视图场景网格导出  
  - 如果是 STEP/IGES/BREP：从选中 `ShapeNode` 上聚合几何，调用 `shapeFactory.converter.convertTo*`

---

### 5. Three.js 渲染与交互工作原理

渲染与交互主要由 `@chili3d/three` 完成，结合 core 的可视化抽象：

- **场景与 Visual**：  
  - `ThreeVisual` 初始化 `Scene`，添加环境光、坐标轴，并创建：  
    - `ThreeVisualContext`：管理所有 `ThreeVisualObject` / `ThreeGeometry` / CSS2D Object  
    - `ThreeHighlighter`：对选中形体/子形体高亮  
    - `ThreeMeshExporter`：从当前可视节点导出网格数据  
  - `Document` 中的 `visual` 字段就是 `ThreeVisual` 实例

- **视图与相机**（`ThreeView`）：  
  - 挂接在 `ThreeVisual.createView(name, workplane)` 中创建  
  - 内部包含：  
    - `cameraController`：统一管理 Camera 的类型（透视/正交）、位置、target、缩放  
    - `dynamicLight`：跟随相机方向变换的方向光  
    - `Renderer` + `CSS2DRenderer`：渲染几何与标签  
    - `ViewGizmo`：右下角的视图小组件（坐标系）  
  - 渲染循环 `animate()`：  
    - 使用 `_needsUpdate` flag，只有场景变化时才真正重绘  
    - 每帧更新动态光方向、渲染场景 + CSS2D、更新 Gizmo

- **拾取与几何映射**：  
  - 鼠标坐标首先被换算到标准化设备坐标（NDC）：`screenToCameraRect(mx, my)`  
  - `rayAt(mx, my)`：  
    - 透视相机：从相机位置发射射线，方向为经过该点的视线方向  
    - 正交相机：在视锥中构造对应点，方向为固定 -Z（在世界坐标中的方向）  
    - 然后转换到 core 层的 `Ray`（origin + direction in XYZ）  
  - `detectVisual` / `detectVisualRect`：  
    - 利用 Three 的 `Raycaster` 或 `SelectionBox` 找到被击中的 Three 对象  
    - 把 `ThreeMeshObject` / `ThreeGeometry` / `ThreeComponentObject` 映射回 core 层的 `VisualNode`（`ShapeNode` / `MultiShapeNode` 等）  
  - `detectShapes` / `detectShapesRect`：  
    - 在已有交点基础上，查找对应 `IShape` / `ISubShape`，并根据 `ShapeType` 决定返回整形体、面、边、壳或体  
    - 同时返回 `transform: Matrix4` 与该子形体的 mesh 索引范围，便于高亮和后续操作

- **事件处理与命令**：  
  - 所有鼠标事件（`onPointerDown` / `onPointerMove` / `onPointerUp`）会委托给当前视图的 `eventHandler`：  
    - 默认是 `NodeSelectionHandler`：实现基本的节点/形体选择逻辑  
    - 命令执行时，可以替换为其他事件处理器（如拉伸/布尔操作的交互步骤），命令结束后调用 `resetEventHandler()` 恢复  
  - `CommandService` / `EditorService` 会把 UI（Ribbon/快捷键）上的命令映射为具体的命令实现，并与视图事件协同驱动几何操作

---

### 6. 命令系统与 Ribbon 界面

Chili3D 采用典型的 Office 风格 Ribbon 界面 + 命令模式：

- `@chili3d/builder/src/ribbon.ts` 中的 `DefaultRibbon` 配置了各个 Tab/Group/Command：  
  - `ribbon.tab.startup` / `ribbon.group.draw` / `ribbon.group.modify` / `ribbon.group.boolean` 等  
  - `items` 中填的是命令键：如 `"create.line"`、`"boolean.cut"`、`"measure.length"` 等  
- core 中的命令系统（`ICommand` + CommandService）：  
  - 会根据命令键找到具体命令实现（`@chili3d/app/src/commands/*` 下大量命令类）  
  - 命令内部通常负责：  
    - 从当前 `Document` / `Selection` 中读取上下文  
    - 通过 `shapeFactory` 构造或修改几何  
    - 更新 `modelManager` 节点树  
    - 刷新 `visual.update()` 并记录 `history` 以支持撤销/重做  
- UI 层的 `MainWindow` 会根据 Ribbon 配置和命令服务自动创建按钮/下拉列表，并绑定命令执行

命令执行的大致路径是：

> Ribbon / 快捷键 → CommandService 执行命令对象  
> → 命令通过 `Application` 访问当前文档/视图/选择  
> → 通过 `shapeFactory` / `shapeFactory.converter` 调用 WASM/OCCT  
> → 更新文档模型 → 触发 `visual.update()` → Three.js 视图重绘

---

### 7. 存储、插件与扩展点

#### 7.1 存储与文档管理

- `IDocument` 接口中定义了文档的 `id` / `name` / `history` / `serialize()` 等  
- `Application` 提供：  
  - `newDocument(name)`：新建文档，默认添加两个灰色材质，并创建 3D 视图  
  - `openDocument(id)`：通过 `storage` 打开已有文档  
  - `loadDocument(data)`：从 JSON（通常是 `.cd` 文件内容）恢复文档  
- `storage` 由 `@chili3d/storage` 提供，目前实现是基于 IndexedDB 的 `IndexedDBStorage`

#### 7.2 插件系统

- `Application` 持有 `pluginManager`，其加载逻辑包括：  
  - 拖拽 `.chiliplugin` 文件到窗口时，通过 `PluginManager.loadFromFile` 加载  
  - 通过 URL 参数 `plugin` 或默认 `plugins/plugins.json` 列表加载远程插件  
- 插件可以访问：  
  - `globalThis.ChiliCore`（core API）  
  - `Application` 实例（通过命令/服务注册新功能）  
  - Ribbon 与 i18n（通过附加模块或插件内部逻辑添加新界面/命令）

---

### 8. 典型工作流示例：从点击“拉伸”到三维模型显示

以“拉伸一个矩形”生成立方体为例，梳理完整链路：

1. **用户交互**：  
   - 在 Ribbon 上点击“矩形（`create.rect`）”命令，随后在视图中画一个矩形轮廓；  
   - 再点击“拉伸（`create.prism` 或 `create.extrude`）”命令并输入高度。
2. **命令系统**：  
   - `CommandService` 触发对应命令对象：  
     - 读取当前文档/工作平面 `Plane` 和用户输入参数（矩形尺寸、高度等）  
     - 通过 `shapeFactory.rect(plane, dx, dy)` 得到一个 `IFace`  
     - 再通过 `shapeFactory.prism(face, vec)` 把面沿 `vec` 方向拉伸为 `ISolid`
3. **WASM / OCCT**：  
   - `shapeFactory.rect` → 调用 `wasm.ShapeFactory.rect(...)` → OCCT 生成一个平面面片形体  
   - `shapeFactory.prism` → 调用 `wasm.ShapeFactory.prism(...)` → OCCT 做体积拉伸，并返回 `TopoDS_Shape`  
   - C++ 侧将结果封装为 `ShapeResult` 并导出  
   - TS 侧使用 `convertShapeResult` 把结果包装成 `OccShape` + `Result<ISolid>`
4. **文档与可视更新**：  
   - 命令构造 `EditableShapeNode`，将 `ISolid` 加入 `document.modelManager`  
   - 调用 `document.visual.update()` 通知所有关联视图需要重绘  
5. **Three.js 渲染**：  
   - `ThreeVisualContext` 为新形体创建对应的 `ThreeGeometry` / `ThreeMeshObject` 等 Three 对象  
   - `ThreeView.update()` 标记 `_needsUpdate = true`  
   - 在下一帧 `animate()` 中，ThreeView 渲染场景 + CSS2D 标签，视图中出现新的立方体模型

---

### 9. 总结：理解 Chili3D 的几个关键点

- **分层清晰**：core 抽象一切概念，wasm/three 分别实现几何内核和可视内核，app 结合命令+文档+服务，web 只是一个载体。  
- **所有“几何计算”都在 WASM/OCCT 中完成**：TS 层主要做调度、数据管理和 UI/交互。  
- **命令系统 + Ribbon** 把用户操作解耦为命令对象，方便扩展和插件注入。  
- **View 负责坐标系转换与拾取**：鼠标坐标 → 射线 → Three 对象 → 核心几何对象，是交互的关键桥梁。  
- **插件与附加模块**提供良好的扩展点：可以增加命令、Ribbon 分组、i18n 文本、甚至自定义 UI 或几何逻辑。

有了以上解构，你可以从任意需求切入：  
- 改几何能力 → 先看 `@chili3d/wasm` 和 `cpp/src/*`；  
- 改渲染/交互 → 看 `@chili3d/three`；  
- 加工具/命令/批量处理 → 看 `@chili3d/app` 的命令体系 + `@chili3d/builder` + Ribbon；  
- 做集成或二次开发 → 从 `@chili3d/web` 入口与插件系统入手。

