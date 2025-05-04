// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { IPropertyChanged, PathBinding } from "chili-core";
import { Localize } from "./localize";

export type HTMLProps<T> = {
    [P in keyof T]?: T[P] extends object
        ? HTMLProps<T[P]>
        : (T[P] | PathBinding<IPropertyChanged>) | (P extends "textContent" ? Localize : never);
};
