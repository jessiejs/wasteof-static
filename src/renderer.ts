import { Stream, Writable } from 'stream';
import fetch from 'node-fetch';
import { readFile } from 'fs/promises';
import { join } from 'path';
import bufferToDataUrl from "buffer-to-data-url"
import { parse, Node, NodeType, TextNode, HTMLElement } from 'node-html-parser';

class Renderer {
	output: Writable;

	scriptBundles: Promise<string>[] = [];
	styleBundles: Promise<string>[] = [];

	importedStyles: string[] = [];
	importedScripts: string[] = [];

	includeBundlesImmediately: boolean = true;

	constructor(output: Writable) {
		this.output = output;
	}

	async write(text: string) {
		/*const chars = Array.from(text);
		for (let i = 0; i < chars.length; i++) {
			this.output.write(chars[i]);
			//await this.wait(0);
		}*/
		this.output.write(text);
		//await this.wait(10);
	}

	wait(ms: number): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	style(object: Record<string, string>) {
		let output = '';
		for (const styleName in object) {
			output += this.camelCaseToDashCase(styleName);
			output += ':';
			output += object[styleName];
			output += ';';
		}
		return output;
	}

	camelCaseToDashCase(text: string) {
		let output = '';
		for (let i = 0; i < text.length; i++) {
			if (text[i].toLowerCase() != text[i]) {
				output += '-';
			}
			output += text[i].toLowerCase();
		}
		return output;
	}

	async reconstructNode(node:Node) {
		if (node instanceof HTMLElement) {
			if (node.tagName == 'img') {
				if (node.attrs['src']) {
					node.attrs.src = await bufferToDataUrl('application/octet-stream',Buffer.from(await AssetLoading.loadWebResource(node.attrs.src)));
				}
			}
		}
		for (const subNode of node.childNodes) {
			await this.reconstructNode(subNode);
		}
	}

	async htmlTemplate(callback: () => Promise<void>) {
		await this.write('<!DOCTYPE html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>wasteof.static</title><body>');
		await this.includeStyleBundle('page');
		if (this.includeBundlesImmediately) {
			await this.element("style",{},async () => {
				await this.renderFontImport();
			});
		}
		await callback();
		await this.write('</body><head>');
		await this.renderBundles();
		await this.write('</head></html>');
	}

	async renderUserFeed(username: string) {
		const posts = (
			JSON.parse(
				await AssetLoading.loadWebResource(
					'https://api.wasteof.money/users/' +
						username +
						'/following/posts',
					true
				)
			) as {
				posts: Post[];
			}
		).posts;

		await this.element('h1', {}, async () => {
			await this.write('feed');
		});

		for (const post of posts) {
			await this.renderPost(post);
		}
	}

	async convertHTML(html:string) {
		const realHTML = parse(html);
		await this.reconstructNode(realHTML);
		return realHTML.toString();
	}

	async renderPost(post: Post) {
		await this.includeStyleBundle('post');
		await this.element(
			'div',
			{
				class: 'post',
			},
			async () => {
				await this.element('h3', {}, async () => {
					await this.write(post.poster.name);
				});
				await this.write(await this.convertHTML(post.content));
				if (post.repost) {
					await this.renderPost(post.repost);
				}
				if (post.revisions.length > 1) {
					await this.element('p', {}, async () => {
						await this.element('i', {}, async () => {
							await this.write('(edited)');
						});
					});
				}
				await this.element('p', {}, async () => {
					await this.element('button', {}, async () => {
						await this.write(`💕 ${post.loves}`);
					});
					await this.element('button', {}, async () => {
						await this.write(`🔃 ${post.reposts}`);
					});
					await this.element('button', {}, async () => {
						await this.write(`💬 ${post.comments}`);
					});
				});
				await this.renderPostComments(post);
			}
		);
	}

	async renderPostComments(post: Post) {
		const comments = JSON.parse(
			await AssetLoading.loadWebResource(
				'https://api.wasteof.money/posts/' +
					post._id +
					'/comments?page=1'
			)
		) as {
			comments: Comment[];
		};

		if (comments.comments.length > 0) {
			await this.element('h3', {}, async () => {
				await this.write('Comments');
			});
		}

		for (const comment of comments.comments) {
			await this.renderComment(comment);
		}
	}

	async renderCommentReplies(comment: Comment) {
		const replies = JSON.parse(
			await AssetLoading.loadWebResource(
				'https://api.wasteof.money/comments/' +
					comment._id +
					'/replies?page=1'
			)
		) as {
			comments: Comment[];
		};
		for (const comment of replies.comments) {
			await this.renderComment(comment);
		}
	}

	async renderComment(comment: Comment) {
		await this.element(
			'div',
			{
				class: 'post',
			},
			async () => {
				await this.element('h3', {}, async () => {
					await this.write(comment.poster.name);
				});
				await this.write(await this.convertHTML(comment.content));
				await this.renderCommentReplies(comment);
			}
		);
	}

	async element(
		name: string,
		properties: Record<string, string>,
		callback: () => Promise<void>
	) {
		// write opening
		await this.write('<');
		await this.write(name);

		// write props
		for (const propName in properties) {
			await this.write(' ');
			await this.write(propName);
			await this.write('="');
			await this.write(properties[propName]);
			await this.write('"');
		}

		// write end of beginning
		await this.write('>');

		// write content
		await callback();

		// write end
		await this.write('</');
		await this.write(name);
		await this.write('>');
	}

	async includeScriptBundle(name: string) {
		if (!this.importedScripts.includes(name)) {
			this.importedScripts.push(name);
			if (this.includeBundlesImmediately) {
				await this.element('script',{}, async () => {
					this.write(await AssetLoading.loadFile(
						join(__dirname, '../', 'scripts', name + '.js')
					));
				});
			} else {
				this.scriptBundles.push(
					AssetLoading.loadFile(
						join(__dirname, '../', 'scripts', name + '.js')
					)
				);
			}
		}
	}

	async includeStyleBundle(name: string) {
		if (!this.importedStyles.includes(name)) {
			this.importedStyles.push(name);
			if (this.includeBundlesImmediately) {
				await this.element('style',{}, async () => {
					this.write(await AssetLoading.loadFile(
						join(__dirname, '../', 'styles', name + '.css')
					));
				});
			} else {
				this.styleBundles.push(
					AssetLoading.loadFile(
						join(__dirname, '../', 'styles', name + '.css')
					)
				);
			}
		}
	}

	async renderBundles() {
		if (this.includeBundlesImmediately) {
			return;
		}
		await this.element('script', {}, async () => {
			await this.write((await Promise.all(this.scriptBundles)).join(' '));
		});
		await this.element('style', {}, async () => {
			await this.write((await Promise.all(this.styleBundles)).join(' '));
			await this.renderFontImport();
		});
	}

	async renderFontImport() {
		// write start
		await this.write(
			'@font-face { font-family: "Satoshi"; font-weight: 500; font-display: swap; font-style: normal; src: url("'
		);
		// write data url
		/*await this.write(
			await AssetLoading.loadFile(
				join(__dirname, '../', 'SatoshiDataUri.txt')
			)
		);*/
		await this.write(await bufferToDataUrl('application/octet-stream',await readFile(join(__dirname,'../','styles','Satoshi.ttf'))));
		// TODO: DO NOT LOAD EXTERNAL RESOURCE!!!!!!!!!!!
		/*await this.write(
			'//cdn.fontshare.com/wf/P2LQKHE6KA6ZP4AAGN72KDWMHH6ZH3TA/ZC32TK2P7FPS5GFTL46EU6KQJA24ZYDB/7AHDUZ4A7LFLVFUIFSARGIWCRQJHISQP.ttf'
		);*/
		await this.write('") format("truetype") }');
	}
}

class AssetLoading {
	static fileCache: Record<string, string> = {};
	static webResources: Record<string, string> = {};

	static async loadFile(path: string, burnCache?: boolean): Promise<string> {
		if (burnCache === true) {
			delete this.fileCache[path];
		}
		if (this.fileCache[path]) {
			return this.fileCache[path];
		}
		console.log("file not cached, loading: " + path);
		this.fileCache[path] = (await readFile(path)).toString();
		return this.fileCache[path];
	}

	static async loadWebResource(path: string, burnCache?: boolean) {
		if (burnCache === true) {
			delete this.webResources[path];
		}
		if (this.webResources[path]) {
			return this.webResources[path];
		}
		console.log("page not cached, loading: " + path);
		this.webResources[path] = await (await fetch(path)).text();
		return this.webResources[path];
	}
}

type Post = {
	_id: string;
	poster: Poster;
	content: string;
	repost?: Post;
	time: number;
	revisions: {
		content: string;
		time: number;
		current: boolean;
	}[];
	comments: number;
	loves: number;
	reposts: number;
};

type Poster = {
	name: string;
	id: string;
};

type Comment = {
	_id: string;
	post: string;
	poster: Poster;
	parent: any;
	content: string;
	time: number;
	hasReplies: boolean;
};

export { Renderer };
