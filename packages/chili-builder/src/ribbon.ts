// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { RibbonTab } from "chili-core";

export const DefaultRibbon: RibbonTab[] = [
    {
        tabName: "ribbon.tab.startup",
        groups: [
            {
                groupName: "ribbon.group.draw",
                items: [
                    "create.line",
                    "create.arc",
                    "create.rect",
                    "create.circle",
                    ["create.ellipse", "create.bezier", "create.polygon"],
                    ["create.box", "create.pyramid", "create.cylinder"],
                    ["create.cone", "create.sphere", "create.thickSolid"],
                ],
            },
            {
                groupName: "ribbon.group.modify",
                items: [
                    "modify.move",
                    "modify.rotate",
                    "modify.mirror",
                    ["modify.split", "modify.break", "modify.trim"],
                    ["modify.fillet", "modify.chamfer", "modify.explode"],
                    ["modify.delete", "modify.removeSubShapes", "modify.removeFeature"],
                ],
            },
            {
                groupName: "ribbon.group.converter",
                items: [
                    "convert.prism",
                    "convert.sweep",
                    "convert.revol",
                    "convert.toWire",
                    ["convert.toFace", "convert.toShell", "convert.toSolid"],
                ],
            },
            {
                groupName: "ribbon.group.boolean",
                items: ["boolean.common", "boolean.cut", "boolean.fuse"],
            },
            {
                groupName: "ribbon.group.workingPlane",
                items: [
                    "workingPlane.toggleDynamic",
                    ["workingPlane.set", "workingPlane.alignToPlane", "workingPlane.fromSection"],
                ],
            },
            {
                groupName: "ribbon.group.tools",
                items: ["create.section", "create.offset", "create.copySubShape"],
            },
            {
                groupName: "ribbon.group.importExport",
                items: ["file.import", "file.export"],
            },
        ],
    },
    {
        tabName: "ribbon.tab.draw",
        groups: [
            {
                groupName: "ribbon.group.2d",
                items: [
                    "create.line",
                    "create.rect",
                    "create.circle",
                    "create.arc",
                    "create.ellipse",
                    "create.polygon",
                    "create.bezier",
                ],
            },
            {
                groupName: "ribbon.group.3d",
                items: [
                    "create.box",
                    "create.pyramid",
                    "create.cylinder",
                    "create.cone",
                    "create.sphere",
                    "create.thickSolid",
                ],
            },
        ],
    },
    {
        tabName: "ribbon.tab.tools",
        groups: [
            {
                groupName: "ribbon.group.modify",
                items: [
                    "modify.break",
                    "modify.trim",
                    "modify.fillet",
                    "modify.chamfer",
                    "modify.removeFeature",
                ],
            },
            {
                groupName: "ribbon.group.tools",
                items: ["create.section", "modify.split", "convert.toWire", "convert.toFace"],
            },
            {
                groupName: "ribbon.group.other",
                items: ["test.performace"],
            },
        ],
    },
];
