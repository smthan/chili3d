// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPlugins = path.join(root, "public", "plugins");

function runPackage(pluginDir) {
    const cwd = path.join(root, "plugins", pluginDir);
    execSync("npm run package", { cwd, stdio: "inherit", shell: true });
}

mkdirSync(publicPlugins, { recursive: true });

runPackage("helloworld-js");
runPackage("macro");

const copies = [
    ["plugins/helloworld-js/dist/helloworld-js.chiliplugin", "helloworld-js.chiliplugin"],
    ["plugins/macro/dist/macro.chiliplugin", "macro.chiliplugin"],
];

for (const [relSrc, name] of copies) {
    const from = path.join(root, relSrc);
    const to = path.join(publicPlugins, name);
    copyFileSync(from, to);
    console.log(`Copied ${name} -> public/plugins/${name}`);
}
