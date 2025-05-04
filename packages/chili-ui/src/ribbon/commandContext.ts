// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    Binding,
    Combobox,
    Command,
    I18nKeys,
    ICommand,
    IDisposable,
    Observable,
    Property,
} from "chili-core";
import { button, div, input, label, localize, option, select, svg } from "../components";
import style from "./commandContext.module.css";

export class CommandContext extends HTMLElement implements IDisposable {
    private readonly propMap: Map<string | number | symbol, [Property, HTMLElement]> = new Map();

    constructor(readonly command: ICommand) {
        super();
        this.className = style.panel;
        let data = Command.getData(command);
        this.append(
            svg({ className: style.icon, icon: data!.icon }),
            label({ className: style.title, textContent: localize(data!.display) }, `: `),
        );
        this.initContext();
    }

    connectedCallback(): void {
        if (this.command instanceof Observable) {
            this.command.onPropertyChanged(this.onPropertyChanged);
        }
    }

    disconnectedCallback(): void {
        if (this.command instanceof Observable) {
            this.command.removePropertyChanged(this.onPropertyChanged);
        }
    }

    dispose() {
        this.propMap.clear();
    }

    private readonly onPropertyChanged = (property: string | number | symbol) => {
        if (this.propMap.has(property)) {
            const [prop, control] = this.propMap.get(property)!;
            this.setVisible(control, prop);
        }
    };

    private initContext() {
        const groupMap = new Map<I18nKeys, HTMLDivElement>();
        Property.getProperties(this.command).forEach((g) => {
            const group = this.findGroup(groupMap, g);
            const item = this.createItem(this.command, g);
            this.setVisible(item, g);
            this.cacheDependencies(item, g);
            group.append(item);
        });
    }

    private cacheDependencies(item: HTMLElement, g: Property) {
        if (g.dependencies) {
            for (const d of g.dependencies) {
                this.propMap.set(d.property, [g, item]);
            }
        }
    }

    private setVisible(control: HTMLElement, property: Property) {
        let visible = true;
        if (property.dependencies) {
            for (const d of property.dependencies) {
                if ((this.command as any)[d.property] !== d.value) {
                    visible = false;
                    break;
                }
            }
        }
        control.style.display = visible ? "" : "none";
    }

    private findGroup(groupMap: Map<I18nKeys, HTMLDivElement>, prop: Property) {
        let group = groupMap.get(prop.group!);
        if (group === undefined) {
            group = div({ className: style.group });
            groupMap.set(prop.group!, group);
            this.append(group);
        }
        return group;
    }

    private createItem(command: ICommand, g: Property) {
        const noType = command as any;
        const type = typeof noType[g.name];

        switch (type) {
            case "function":
                return this.newButton(g, noType);
            case "boolean":
                return this.newCheckbox(g, noType);
            case "number":
                return this.newInput(g, noType, parseFloat);
            case "string":
                return this.newInput(g, noType);
            default:
                if (noType[g.name] instanceof Combobox) {
                    return this.newCombobox(noType, g);
                }
                throw new Error("暂不支持的类型");
        }
    }

    private newCombobox(noType: any, g: Property) {
        let combobox = noType[g.name] as Combobox<any>;
        let options = combobox.items.map((item, index) =>
            option({
                selected: index === combobox.selectedIndex,
                textContent: combobox.converter?.convert(item).unchecked() ?? String(item),
            }),
        );

        return div(
            label({ textContent: localize(g.display) }),
            select(
                {
                    className: style.select,
                    onchange: (e) => {
                        combobox.selectedIndex = (e.target as HTMLSelectElement).selectedIndex;
                    },
                },
                ...options,
            ),
        );
    }

    private newInput(g: Property, noType: any, converter?: (v: string) => any) {
        return div(
            label({ textContent: localize(g.display) }),
            input({
                type: "text",
                className: style.input,
                value: new Binding(noType, g.name),
                onkeydown: (e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                        const input = e.target as HTMLInputElement;
                        noType[g.name] = converter ? converter(input.value) : input.value;
                        input.blur();
                    }
                },
            }),
        );
    }

    private newCheckbox(g: Property, noType: any) {
        return div(
            label({ textContent: localize(g.display) }),
            input({
                type: "checkbox",
                checked: new Binding(noType, g.name),
                onclick: () => {
                    noType[g.name] = !noType[g.name];
                },
            }),
        );
    }

    private newButton(g: Property, noType: any) {
        return button({
            className: style.button,
            textContent: localize(g.display),
            onclick: () => noType[g.name](),
        });
    }
}

customElements.define("command-context", CommandContext);
