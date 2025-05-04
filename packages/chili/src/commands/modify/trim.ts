// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    BoundingBox,
    CancelableCommand,
    EditableShapeNode,
    GeometryNode,
    I18n,
    ICurve,
    IDocument,
    IEdge,
    IShape,
    IShapeFilter,
    ITrimmedCurve,
    IView,
    IVisualGeometry,
    ShapeNode,
    ShapeType,
    Transaction,
    VisualConfig,
    VisualShapeData,
    command,
} from "chili-core";
import { GeoUtils } from "chili-geo";
import { ShapeSelectionHandler } from "chili-vis";

@command({
    name: "modify.trim",
    display: "command.trim",
    icon: "icon-trim",
})
export class Trim extends CancelableCommand {
    protected override async executeAsync() {
        let transaction = new Transaction(this.document, I18n.translate("command.trim"));
        transaction.start();
        try {
            await this.trimAsync();
        } catch (e) {
            transaction.rollback();
            throw e;
        }
        transaction.commit();
    }

    private async trimAsync() {
        this.document.visual.highlighter.clear();
        this.document.selection.clearSelection();

        while (!this.isCompleted) {
            this.controller = new AsyncController();
            let handler = new PickTrimEdgeEventHandler(this.document, this.controller);
            await this.document.selection.pickAsync(
                handler,
                "prompt.select.edges",
                this.controller,
                false,
                "select.default",
            );
            if (this.controller.result?.status !== "success" || !handler.selected) {
                break;
            }
            this.trimEdge(handler.selected);
        }
    }

    private trimEdge(selected: TrimEdge) {
        let model = this.document.visual.context.getNode(selected.edge.owner);
        let materialId = (model as GeometryNode)?.materialId;
        selected.segments.retainSegments.forEach((segment) => {
            let newEdge = selected.curve.trim(segment.start, segment.end).makeEdge();
            model?.parent?.add(new EditableShapeNode(this.document, model.name, newEdge, materialId));
        });
        model?.parent?.remove(model);
    }
}

export class EdgeFilter implements IShapeFilter {
    allow(shape: IShape): boolean {
        return shape.shapeType === ShapeType.Edge;
    }
}

interface TrimEdge {
    edge: VisualShapeData;
    curve: ICurve;
    segments: {
        deleteSegment: {
            start: number;
            end: number;
        };
        retainSegments: {
            start: number;
            end: number;
        }[];
    };
}

export class PickTrimEdgeEventHandler extends ShapeSelectionHandler {
    #selected: TrimEdge | undefined;
    private highlightedEdge: number | undefined;
    private highlight: undefined | TrimEdge;

    get selected() {
        return this.#selected;
    }

    constructor(document: IDocument, controller: AsyncController) {
        super(document, ShapeType.Shape, false, controller, new EdgeFilter());
    }

    protected override setHighlight(view: IView, detecteds: VisualShapeData[]): void {
        this.cleanHighlights();
        if (detecteds.length !== 1 || detecteds[0].shape.shapeType !== ShapeType.Edge) return;
        let edge = detecteds[0].shape as IEdge;
        let curve = edge.curve();
        let segments = findSegments(curve, edge, findEdges(detecteds, view), detecteds);
        let mesh = edge.trim(segments.deleteSegment.start, segments.deleteSegment.end).mesh.edges!;
        mesh.color = VisualConfig.highlightEdgeColor;
        mesh.lineWidth = 3;
        this.highlightedEdge = view.document.visual.highlighter.highlightMesh(mesh);
        this.highlight = { edge: detecteds[0], segments, curve };
        view.update();
    }

    protected override cleanHighlights(): void {
        if (this.highlightedEdge !== undefined) {
            this.document.visual.highlighter.removeHighlightMesh(this.highlightedEdge);
            this.highlightedEdge = undefined;
            this.highlight = undefined;
            this.document.application.activeView?.update();
        }
    }

    protected override clearSelected(document: IDocument): void {
        this.#selected = undefined;
    }

    protected override select(view: IView, event: PointerEvent): number {
        this.#selected = this.highlight;
        return this.#selected ? 1 : 0;
    }
}

function findEdges(detecteds: VisualShapeData[], view: IView) {
    let boundingBox = BoundingBox.expand(detecteds[0].owner.boundingBox(), 1e-3);
    let otherEdges = view.document.visual.context
        .boundingBoxIntersectFilter(boundingBox, new EdgeFilter())
        .map((x) => ((x as IVisualGeometry)?.geometryNode as ShapeNode)?.shape.value as IEdge)
        .filter((x) => x !== undefined && x.id !== detecteds[0].shape.id);
    return otherEdges;
}

function findSegments(curve: ITrimmedCurve, edge: IEdge, otherEdges: IEdge[], detecteds: VisualShapeData[]) {
    let intersections = GeoUtils.intersects(edge, otherEdges).map((x) => x.parameter);
    intersections.push(curve.firstParameter(), curve.lastParameter());
    intersections = Array.from(new Set(intersections)).sort((a, b) => a - b);

    if (intersections.length === 2) return allSegment(intersections);

    let parameter = curve.parameter(detecteds[0].point!, 5)!;
    for (let i = 1; i < intersections.length; i++) {
        if (parameter < intersections[i]) {
            if (i === 1) {
                return startSegment(intersections);
            } else if (i === intersections.length - 1) {
                return lastSegment(intersections);
            } else {
                return centerSegment(intersections, i);
            }
        }
    }

    return allSegment(intersections);
}

function allSegment(intersections: number[]) {
    return {
        deleteSegment: {
            start: intersections[0],
            end: intersections.at(-1)!,
        },
        retainSegments: [],
    };
}

function centerSegment(intersections: number[], i: number) {
    return {
        deleteSegment: {
            start: intersections.at(i - 1)!,
            end: intersections.at(i)!,
        },
        retainSegments: [
            {
                start: intersections[0],
                end: intersections[i - 1],
            },
            {
                start: intersections[i],
                end: intersections.at(-1)!,
            },
        ],
    };
}

function lastSegment(intersections: number[]) {
    return {
        deleteSegment: {
            start: intersections.at(-2)!,
            end: intersections.at(-1)!,
        },
        retainSegments: [
            {
                start: intersections[0],
                end: intersections.at(-2)!,
            },
        ],
    };
}

function startSegment(intersections: number[]) {
    return {
        deleteSegment: {
            start: intersections[0],
            end: intersections[1],
        },
        retainSegments: [
            {
                start: intersections[1],
                end: intersections.at(-1)!,
            },
        ],
    };
}
