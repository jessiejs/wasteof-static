import { readFile } from 'fs/promises';
import fetch from 'node-fetch';

class AssetLoading {
	static fileCache: Record<string, string> = {};
	static webResources: Record<string, string> = {};

	static async loadFile(path: string, burnCache?: boolean): Promise<string> {
		//if (burnCache === true) {
			delete this.fileCache[path];
		//}
		if (this.fileCache[path]) {
			return this.fileCache[path];
		}
		console.log("file not cached, loading: " + path);
		this.fileCache[path] = (await readFile(path)).toString();
		return this.fileCache[path];
	}

	static async loadWebResource(path: string, burnCache?: boolean) {
		//if (burnCache === true) {
			delete this.webResources[path];
		//}
		if (this.webResources[path]) {
			return this.webResources[path];
		}
		console.log("page not cached, loading: " + path);
		this.webResources[path] = await (await fetch(path)).text();
		return this.webResources[path];
	}
}

export { AssetLoading };
