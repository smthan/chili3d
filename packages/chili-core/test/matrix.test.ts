// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Matrix4, Plane, XYZ } from "../src";

describe("test Transform", () => {
    test("test constructor", () => {
        let transform = new Matrix4();
        expect(transform.toArray().length).toBe(16);
        expect(transform.toArray()).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    test("test clone", () => {
        let t1 = new Matrix4();
        let t2 = t1.position(1, 0, 0);
        expect(t1.toArray()).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(t2.toArray()).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
    });

    test("test operation", () => {
        let t1 = Matrix4.createTranslation(10, 0, 0);
        let p1 = XYZ.zero;
        let v1 = XYZ.unitY;
        let p2 = t1.ofPoint(p1);
        let v2 = t1.ofVector(v1);
        expect(p2).toStrictEqual(new XYZ(10, 0, 0));
        expect(v2).toStrictEqual(v1);
        let t2 = t1.invert();
        expect(t2!.ofPoint(p2)).toStrictEqual(p1);

        let t3 = Matrix4.createRotationAt(XYZ.zero, XYZ.unitZ, Math.PI * 0.5);
        expect(t3.ofVector(v1).isEqualTo(new XYZ(-1, 0, 0))).toBeTruthy();

        let t4 = Matrix4.createScale(0.5, 1.5, 0);
        let p3 = new XYZ(1, 1, 0);
        expect(t4.ofPoint(p3)).toStrictEqual(new XYZ(0.5, 1.5, 0));

        let t5 = t1.multiply(t3);
        expect(t5.ofPoint(XYZ.unitY).isEqualTo(new XYZ(-1, 10, 0))).toBeTruthy();
        let t6 = t5.invert();
        expect(t6!.ofPoint(new XYZ(-1, 10, 0)).isEqualTo(XYZ.unitY)).toBeTruthy();

        let rotate = Matrix4.createRotationAt(new XYZ(1, 1, 0), XYZ.unitZ, Math.PI * 0.5);
        expect(rotate.ofPoint(XYZ.unitX).isEqualTo(new XYZ(2, 1, 0))).toBeTruthy();
    });

    test("test mirror", () => {
        let mirror = Matrix4.createMirrorWithPlane(new Plane(XYZ.zero, XYZ.unitX, XYZ.unitY));
        expect(mirror.ofPoint(new XYZ(-1, 0, 0)).isEqualTo(XYZ.unitX)).toBeTruthy();

        mirror = Matrix4.createMirrorWithPlane(new Plane(XYZ.unitX, XYZ.unitX, XYZ.unitY));
        expect(mirror.ofPoint(new XYZ(-1, 0, 0)).isEqualTo(new XYZ(3, 0, 0))).toBeTruthy();
    });
});
